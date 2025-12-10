import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Mic, Image as ImageIcon, CheckCircle } from "lucide-react";
import { N8N_CONFIG, triggerWebhookWithRetry } from "@/config/n8n";
import MemberSidebar from "@/components/member/MemberSidebar";
import MemberHeader from "@/components/member/MemberHeader";
import DashboardView from "@/components/member/DashboardView";
import ProfileView from "@/components/member/ProfileView";
import ProjectsView from "@/components/member/ProjectsView";

type SubmissionMode = "text" | "audio" | "image";
type SubmissionStatus = "submitted" | "pending" | "missed" | "on_leave" | "weekend";

interface StandupData {
  yesterday_work: string;
  today_plan: string;
  blockers: string;
  next_steps: string;
}

interface HistoryItem {
  id: string;
  date: string;
  status: string;
  submitted_at: string | null;
  yesterday_work: string;
  today_plan: string;
  blockers: string;
  next_steps: string;
}

const MemberDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [departmentName, setDepartmentName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [todayStatus, setTodayStatus] = useState<SubmissionStatus>("pending");
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>(() => {
    return (localStorage.getItem("preferredSubmissionMethod") as SubmissionMode) || "text";
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [expandedHistory, setExpandedHistory] = useState<string | null>(null);
  const [testMode, setTestMode] = useState(() => {
    return localStorage.getItem("testMode") === "true";
  });
  const [streak, setStreak] = useState(0);
  const [totalSubmissions, setTotalSubmissions] = useState(0);
  const [showAudioInstructions, setShowAudioInstructions] = useState(() => {
    const hideCount = parseInt(localStorage.getItem("audioInstructionViews") || "0");
    return hideCount < 3 && localStorage.getItem("hideInstructions") !== "true";
  });
  const [showImageInstructions, setShowImageInstructions] = useState(() => {
    const hideCount = parseInt(localStorage.getItem("imageInstructionViews") || "0");
    return hideCount < 3 && localStorage.getItem("hideInstructions") !== "true";
  });
  
  // Sidebar state
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [currentView, setCurrentView] = useState("dashboard");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  // Text mode state
  const [standupData, setStandupData] = useState<StandupData>({
    yesterday_work: "",
    today_plan: "",
    blockers: "",
    next_steps: ""
  });

  // Audio mode state
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Image mode state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  // Processing state for audio/image
  const [processing, setProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);

  const isWeekend = () => {
    if (testMode) return false;
    const day = new Date().getDay();
    return day === 0 || day === 6;
  };

  useEffect(() => {
    checkUser();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (user) {
      checkTodayStatus();
      fetchHistory();
      fetchStreak();
      fetchTotalSubmissions();
    }
  }, [user]);

  const checkUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select(`
          *,
          departments:department_id (name)
        `)
        .eq("id", user.id)
        .single();

      if (profile?.role !== "member") {
        toast.error("Access denied. Members only.");
        navigate("/auth");
        return;
      }

      setUser(profile);
      setDepartmentName(profile.departments?.name || "Unknown");
    } catch (error) {
      console.error("Error:", error);
      navigate("/auth");
    } finally {
      setLoading(false);
    }
  };

  const checkTodayStatus = async () => {
    if (!user) return;

    if (isWeekend()) {
      setTodayStatus("weekend");
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    const { data: leaveData } = await supabase
      .from("leave_requests")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .eq("status", "approved")
      .maybeSingle();

    if (leaveData) {
      setTodayStatus("on_leave");
      return;
    }

    const { data: standupData } = await supabase
      .from("daily_standups")
      .select("*")
      .eq("user_id", user.id)
      .eq("date", today)
      .maybeSingle();

    if (standupData) {
      setTodayStatus("submitted");
      setSubmittedAt(standupData.submitted_at);
    } else {
      const now = new Date();
      const cutoffTime = new Date();
      cutoffTime.setHours(10, 0, 0, 0);
      
      if (now > cutoffTime) {
        setTodayStatus("missed");
      } else {
        setTodayStatus("pending");
      }
    }
  };

  const fetchStreak = async () => {
    if (!user) return;

    try {
      const { data: submissions } = await supabase
        .from("daily_standups")
        .select("date")
        .eq("user_id", user.id)
        .eq("status", "submitted")
        .order("date", { ascending: false })
        .limit(60);

      if (!submissions || submissions.length === 0) {
        setStreak(0);
        return;
      }

      const submittedDates = new Set(submissions.map(s => s.date));
      let currentStreak = 0;
      let currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);

      const today = currentDate.toISOString().split('T')[0];
      const todayDay = currentDate.getDay();
      
      if (todayDay !== 0 && todayDay !== 6 && !submittedDates.has(today)) {
        currentDate.setDate(currentDate.getDate() - 1);
      }

      for (let i = 0; i < 60; i++) {
        const day = currentDate.getDay();
        
        if (day === 0 || day === 6) {
          currentDate.setDate(currentDate.getDate() - 1);
          continue;
        }

        const dateStr = currentDate.toISOString().split('T')[0];
        
        if (submittedDates.has(dateStr)) {
          currentStreak++;
          currentDate.setDate(currentDate.getDate() - 1);
        } else {
          break;
        }
      }

      setStreak(currentStreak);
    } catch (error) {
      console.error("Error fetching streak:", error);
    }
  };

  const fetchTotalSubmissions = async () => {
    if (!user) return;
    
    const { count } = await supabase
      .from("daily_standups")
      .select("*", { count: 'exact', head: true })
      .eq("user_id", user.id)
      .eq("status", "submitted");
    
    setTotalSubmissions(count || 0);
  };

  const fetchHistory = async () => {
    if (!user) return;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data, error } = await supabase
      .from("daily_standups")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", sevenDaysAgo.toISOString().split('T')[0])
      .order("date", { ascending: false });

    if (error) {
      console.error("Error fetching history:", error);
    } else {
      setHistory(data || []);
    }
  };

  const getTimeRemaining = () => {
    const now = new Date();
    const cutoffTime = new Date();
    cutoffTime.setHours(10, 0, 0, 0);
    
    if (now >= cutoffTime) return null;
    
    const diff = cutoffTime.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    return `${hours}h ${minutes}m remaining`;
  };

  const isWithinSubmissionWindow = () => {
    if (testMode) return true;
    
    const now = new Date();
    const startTime = new Date();
    startTime.setHours(8, 0, 0, 0);
    const endTime = new Date();
    endTime.setHours(10, 0, 0, 0);
    
    return now >= startTime && now < endTime;
  };

  const toggleTestMode = () => {
    const newTestMode = !testMode;
    setTestMode(newTestMode);
    localStorage.setItem("testMode", newTestMode.toString());
    toast.success(newTestMode ? "Test mode enabled" : "Test mode disabled");
  };

  const handleTextSubmit = async () => {
    if (!user || !standupData.yesterday_work || !standupData.today_plan || !standupData.blockers || !standupData.next_steps) {
      toast.error("Please fill in all fields");
      return;
    }

    setSubmitting(true);
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const { error } = await supabase
        .from("daily_standups")
        .insert({
          user_id: user.id,
          date: today,
          yesterday_work: standupData.yesterday_work,
          today_plan: standupData.today_plan,
          blockers: standupData.blockers,
          next_steps: standupData.next_steps,
          status: "submitted"
        });

      if (error) throw error;

      toast.success("Standup submitted successfully!");
      setStandupData({ yesterday_work: "", today_plan: "", blockers: "", next_steps: "" });
      checkTodayStatus();
      fetchHistory();
      fetchStreak();
    } catch (error) {
      console.error("Error submitting standup:", error);
      toast.error("Failed to submit standup");
    } finally {
      setSubmitting(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        setAudioBlob(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingDuration(0);

      recordingIntervalRef.current = setInterval(() => {
        setRecordingDuration(prev => {
          if (prev >= 300) {
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (error) {
      console.error("Error starting recording:", error);
      toast.error("Failed to start recording. Please check microphone permissions.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }
    }
  };

  const playAudio = () => {
    if (audioBlob && !isPlaying) {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        setIsPlaying(false);
      };
      
      audio.play();
      setIsPlaying(true);
    } else if (audioRef.current && isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    }
  };

  const reRecord = () => {
    setAudioBlob(null);
    setRecordingDuration(0);
    setIsPlaying(false);
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
  };

  const handleAudioSubmit = async () => {
    if (!user || !audioBlob) {
      toast.error("Please record your standup");
      return;
    }

    setProcessing(true);
    setProcessingStep(0);

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const fileName = `${user.id}/${today}/standup-audio-${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('daily-standups')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) throw uploadError;
      setProcessingStep(1);

      const { data: urlData } = supabase.storage
        .from('daily-standups')
        .getPublicUrl(fileName);
      
      const audioUrl = urlData.publicUrl;
      setProcessingStep(2);

      if (!N8N_CONFIG.enabled) {
        throw new Error('n8n webhook not configured');
      }

      const webhookPayload = {
        user_id: user.id,
        date: today,
        media_url: audioUrl,
        media_type: 'audio',
        media_filename: fileName,
        bucket: 'daily-standups'
      };

      setProcessingStep(3);

      await triggerWebhookWithRetry(webhookPayload);

      await checkTodayStatus();
      await fetchHistory();
      await fetchStreak();
      
      setAudioBlob(null);
      setRecordingDuration(0);
      setIsPlaying(false);
      
      toast.success('Audio processed successfully!');

    } catch (error) {
      console.error('Error submitting audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        toast.error('Processing is taking longer than expected. Please refresh in a minute.');
      } else {
        toast.error('Failed to process audio: ' + errorMessage);
      }
    } finally {
      setProcessing(false);
      setProcessingStep(0);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.match(/image\/(jpeg|jpg|png)/)) {
      toast.error("Please upload a JPG or PNG image");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview(null);
  };

  const handleImageSubmit = async () => {
    if (!user || !imageFile) {
      toast.error("Please upload an image");
      return;
    }

    setProcessing(true);
    setProcessingStep(0);

    try {
      const today = new Date().toISOString().split('T')[0];
      
      const fileName = `${user.id}/${today}/standup-image-${Date.now()}.${imageFile.type.split('/')[1]}`;
      const { error: uploadError } = await supabase.storage
        .from('daily-standups')
        .upload(fileName, imageFile, {
          contentType: imageFile.type,
          upsert: false
        });

      if (uploadError) throw uploadError;
      setProcessingStep(1);

      const { data: urlData } = supabase.storage
        .from('daily-standups')
        .getPublicUrl(fileName);
      
      const imageUrl = urlData.publicUrl;
      setProcessingStep(2);

      if (!N8N_CONFIG.enabled) {
        throw new Error('n8n webhook not configured');
      }

      const webhookPayload = {
        user_id: user.id,
        date: today,
        media_url: imageUrl,
        media_type: 'image',
        media_filename: fileName,
        bucket: 'daily-standups'
      };

      setProcessingStep(3);

      await triggerWebhookWithRetry(webhookPayload);

      await checkTodayStatus();
      await fetchHistory();
      await fetchStreak();
      
      setImageFile(null);
      setImagePreview(null);
      
      toast.success('Image processed successfully!');

    } catch (error) {
      console.error('Error submitting image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        toast.error('Processing is taking longer than expected. Please refresh in a minute.');
      } else {
        toast.error('Failed to process image: ' + errorMessage);
      }
    } finally {
      setProcessing(false);
      setProcessingStep(0);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
    navigate("/auth");
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatSubmittedTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  const timeRemaining = getTimeRemaining();
  const withinWindow = isWithinSubmissionWindow();
  const canSubmit = testMode || (todayStatus === "pending" && withinWindow);

  return (
    <div className="min-h-screen bg-background flex w-full">
      {/* Processing Overlay */}
      {processing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center animate-pulse">
                {submissionMode === 'audio' ? (
                  <Mic className="w-10 h-10 text-primary" />
                ) : (
                  <ImageIcon className="w-10 h-10 text-primary" />
                )}
              </div>
            </div>
            
            <h3 className="text-xl font-bold text-center mb-2">
              {submissionMode === 'audio' ? 'Processing Your Audio' : 'Processing Your Image'}
            </h3>
            <p className="text-muted-foreground text-center mb-6">
              {submissionMode === 'audio' 
                ? 'Transcribing and extracting your standup details'
                : 'Analyzing and extracting your standup details'}
            </p>
            
            <div className="space-y-3 mb-6">
              <div className="flex items-center gap-3">
                {processingStep >= 1 ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                )}
                <span className={`text-sm ${processingStep >= 1 ? "text-green-600 font-medium" : ""}`}>
                  {submissionMode === 'audio' ? 'Audio uploaded' : 'Image uploaded'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {processingStep >= 2 ? (
                  <CheckCircle className="w-5 h-5 text-green-500" />
                ) : processingStep === 1 ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                )}
                <span className={`text-sm ${processingStep >= 2 ? "text-green-600 font-medium" : ""}`}>
                  {submissionMode === 'audio' ? 'Sent to AI for transcription' : 'Sent to AI for analysis'}
                </span>
              </div>
              <div className="flex items-center gap-3">
                {processingStep >= 3 ? (
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />
                )}
                <span className={`text-sm ${processingStep >= 3 ? "text-primary font-medium" : ""}`}>
                  Extracting standup details...
                </span>
              </div>
            </div>
            
            <p className="text-xs text-muted-foreground text-center">
              This usually takes 30-60 seconds. Please don't close this window.
            </p>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed lg:relative z-50 lg:z-auto transform transition-transform duration-300 lg:transform-none ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <MemberSidebar
          collapsed={sidebarCollapsed}
          onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
          currentView={currentView}
          onViewChange={(view) => {
            setCurrentView(view);
            setMobileMenuOpen(false);
          }}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <MemberHeader
          user={user}
          departmentName={departmentName}
          testMode={testMode}
          onTestModeToggle={toggleTestMode}
          onLogout={handleLogout}
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
        />

        <main className="flex-1 overflow-auto p-4 lg:p-6">
          {currentView === "dashboard" && (
            <DashboardView
              currentTime={currentTime}
              todayStatus={todayStatus}
              submittedAt={submittedAt}
              streak={streak}
              testMode={testMode}
              canSubmit={canSubmit}
              isWeekend={isWeekend()}
              timeRemaining={timeRemaining}
              submissionMode={submissionMode}
              setSubmissionMode={setSubmissionMode}
              standupData={standupData}
              setStandupData={setStandupData}
              submitting={submitting}
              handleTextSubmit={handleTextSubmit}
              isRecording={isRecording}
              audioBlob={audioBlob}
              recordingDuration={recordingDuration}
              isPlaying={isPlaying}
              startRecording={startRecording}
              stopRecording={stopRecording}
              playAudio={playAudio}
              reRecord={reRecord}
              handleAudioSubmit={handleAudioSubmit}
              formatTime={formatTime}
              showAudioInstructions={showAudioInstructions}
              setShowAudioInstructions={setShowAudioInstructions}
              imageFile={imageFile}
              imagePreview={imagePreview}
              handleImageSelect={handleImageSelect}
              handleImageSubmit={handleImageSubmit}
              clearImage={clearImage}
              showImageInstructions={showImageInstructions}
              setShowImageInstructions={setShowImageInstructions}
              history={history}
              expandedHistory={expandedHistory}
              setExpandedHistory={setExpandedHistory}
              formatDate={formatDate}
              formatSubmittedTime={formatSubmittedTime}
            />
          )}

          {currentView === "profile" && (
            <ProfileView
              user={user}
              departmentName={departmentName}
              streak={streak}
              totalSubmissions={totalSubmissions}
            />
          )}

          {currentView === "projects" && (
            <ProjectsView user={user} />
          )}
        </main>
      </div>
    </div>
  );
};

export default MemberDashboard;
