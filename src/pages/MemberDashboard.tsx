import { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { LogOut, Clipboard, CheckCircle, XCircle, Clock, Palmtree, FileText, Mic, Image as ImageIcon, Upload, Play, Pause, RotateCcw, FlaskConical, Settings, Calendar, ChevronDown, ChevronUp, Check } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { N8N_CONFIG, triggerWebhookWithRetry } from "@/config/n8n";

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
  const [showAudioInstructions, setShowAudioInstructions] = useState(() => {
    const hideCount = parseInt(localStorage.getItem("audioInstructionViews") || "0");
    return hideCount < 3 && localStorage.getItem("hideInstructions") !== "true";
  });
  const [showImageInstructions, setShowImageInstructions] = useState(() => {
    const hideCount = parseInt(localStorage.getItem("imageInstructionViews") || "0");
    return hideCount < 3 && localStorage.getItem("hideInstructions") !== "true";
  });
  
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
  const [uploadProgress, setUploadProgress] = useState(0);

  // Processing state for audio/image
  const [processing, setProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState("");
  const [processingStep, setProcessingStep] = useState(0);

  const isWeekend = () => {
    if (testMode) return false; // Bypass weekend check in test mode
    const day = new Date().getDay();
    return day === 0 || day === 6;
  };

  useEffect(() => {
    checkUser();
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute
    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (user) {
      checkTodayStatus();
      fetchHistory();
      fetchStreak();
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

    // Check for weekend first
    if (isWeekend()) {
      setTodayStatus("weekend");
      return;
    }

    const today = new Date().toISOString().split('T')[0];

    // Check for approved leave
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

    // Check for today's submission
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

      // Check if today is a weekday and has submission
      const today = currentDate.toISOString().split('T')[0];
      const todayDay = currentDate.getDay();
      
      // If today is a weekday and not submitted yet, start from yesterday
      if (todayDay !== 0 && todayDay !== 6 && !submittedDates.has(today)) {
        currentDate.setDate(currentDate.getDate() - 1);
      }

      // Count consecutive weekday submissions
      for (let i = 0; i < 60; i++) {
        const day = currentDate.getDay();
        
        // Skip weekends
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
    if (testMode) return true; // Bypass time check in test mode
    
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
    console.log('Test mode:', newTestMode);
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
          if (prev >= 300) { // 5 minutes max
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
    setProcessingStatus('Uploading audio...');
    console.log('🎤 Audio submission started');

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Upload audio to Supabase Storage
      console.log('📤 Uploading to Supabase Storage...');
      const fileName = `${user.id}/${today}/standup-audio-${Date.now()}.webm`;
      const { error: uploadError } = await supabase.storage
        .from('daily-standups')
        .upload(fileName, audioBlob, {
          contentType: 'audio/webm',
          upsert: false
        });

      if (uploadError) throw uploadError;
      console.log('✅ Upload complete');
      setProcessingStep(1);

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('daily-standups')
        .getPublicUrl(fileName);
      
      const audioUrl = urlData.publicUrl;
      console.log('✅ Public URL:', audioUrl);

      setProcessingStatus('Sending to AI for processing...');
      setProcessingStep(2);
      console.log('🔗 Triggering n8n webhook...');

      // 3. Trigger n8n webhook and wait for response (n8n creates the record)
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

      setProcessingStatus('Extracting standup details...');
      setProcessingStep(3);

      await triggerWebhookWithRetry(webhookPayload);
      console.log('✅ Webhook completed successfully');

      // 4. Fetch the created record and update UI
      await checkTodayStatus();
      await fetchHistory();
      
      // Reset audio state
      setAudioBlob(null);
      setRecordingDuration(0);
      setIsPlaying(false);
      
      toast.success('✅ Audio processed successfully!');
      console.log('✅ Processing complete!');

    } catch (error) {
      console.error('Error submitting audio:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        toast.error('⏱️ Processing is taking longer than expected. Please refresh in a minute.');
      } else {
        toast.error('Failed to process audio: ' + errorMessage);
      }
    } finally {
      setProcessing(false);
      setProcessingStatus('');
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

  const handleImageSubmit = async () => {
    if (!user || !imageFile) {
      toast.error("Please upload an image");
      return;
    }

    setProcessing(true);
    setProcessingStep(0);
    setProcessingStatus('Uploading image...');
    console.log('📷 Image submission started');

    try {
      const today = new Date().toISOString().split('T')[0];
      
      // 1. Upload image to Supabase Storage
      console.log('📤 Uploading to Supabase Storage...');
      const fileName = `${user.id}/${today}/standup-image-${Date.now()}.${imageFile.type.split('/')[1]}`;
      const { error: uploadError } = await supabase.storage
        .from('daily-standups')
        .upload(fileName, imageFile, {
          contentType: imageFile.type,
          upsert: false
        });

      if (uploadError) throw uploadError;
      console.log('✅ Upload complete');
      setProcessingStep(1);

      // 2. Get public URL
      const { data: urlData } = supabase.storage
        .from('daily-standups')
        .getPublicUrl(fileName);
      
      const imageUrl = urlData.publicUrl;
      console.log('✅ Public URL:', imageUrl);

      setProcessingStatus('Sending to AI for analysis...');
      setProcessingStep(2);
      console.log('🔗 Triggering n8n webhook...');

      // 3. Trigger n8n webhook and wait for response (n8n creates the record)
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

      setProcessingStatus('Extracting standup details...');
      setProcessingStep(3);

      await triggerWebhookWithRetry(webhookPayload);
      console.log('✅ Webhook completed successfully');

      // 4. Fetch the created record and update UI
      await checkTodayStatus();
      await fetchHistory();
      
      // Reset image state
      setImageFile(null);
      setImagePreview(null);
      
      toast.success('✅ Image processed successfully!');
      console.log('✅ Processing complete!');

    } catch (error) {
      console.error('Error submitting image:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      if (errorMessage.includes('timeout') || errorMessage.includes('Timeout')) {
        toast.error('⏱️ Processing is taking longer than expected. Please refresh in a minute.');
      } else {
        toast.error('Failed to process image: ' + errorMessage);
      }
    } finally {
      setProcessing(false);
      setProcessingStatus('');
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
  // In test mode, force the form to show regardless of submission status
  const canSubmit = testMode || (todayStatus === "pending" && withinWindow);

  return (
    <div className="min-h-screen bg-background">
      {/* Processing Overlay - Blocking Modal */}
      {processing && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-card rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
            {/* Animated icon based on submission type */}
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
                ? 'Our AI is transcribing and extracting your standup details'
                : 'Our AI is analyzing and extracting your standup details'}
            </p>
            
            {/* Progress steps */}
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

      <header className="border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary flex items-center justify-center">
              <Clipboard className="w-6 h-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Daily Standup System</h1>
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <span className="text-sm text-muted-foreground">Welcome, {user?.full_name}</span>
                <span className="hidden sm:inline text-muted-foreground/50">•</span>
                <span className="text-sm text-muted-foreground/70">{departmentName}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Test Mode Toggle */}
            <div className="hidden sm:flex items-center gap-3 px-4 py-2 border rounded-lg bg-card">
              <FlaskConical className={`w-5 h-5 ${testMode ? 'text-yellow-600' : 'text-muted-foreground'}`} />
              <div className="flex items-center gap-2">
                <Label htmlFor="test-mode" className="text-sm font-medium cursor-pointer">
                  Test Mode
                </Label>
                <Switch 
                  id="test-mode"
                  checked={testMode}
                  onCheckedChange={toggleTestMode}
                />
              </div>
            </div>
            <Button onClick={() => navigate('/member/settings')} variant="ghost" size="icon">
              <Settings className="w-5 h-5" />
            </Button>
            <Button onClick={handleLogout} variant="outline" size="sm">
              <LogOut className="w-4 h-4 sm:mr-2" />
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid gap-6">
          {/* Test Mode Warning Banner */}
          {testMode && (
            <div className="bg-yellow-500/10 border-2 border-yellow-500 rounded-lg p-4 flex items-center gap-3">
              <FlaskConical className="w-6 h-6 text-yellow-600" />
              <p className="text-base font-semibold text-yellow-700">
                ⚠️ TEST MODE ACTIVE - Time restrictions disabled
              </p>
            </div>
          )}

          {/* Today's Status Card */}
          <Card>
            <CardHeader>
              <CardTitle>Today's Status</CardTitle>
              <CardDescription>
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-muted rounded-lg">
                <div className="text-sm">
                  <span className="font-medium">Submission Window:</span> 8:00 AM - 10:00 AM
                </div>
                <div className="flex items-center gap-4">
                  {timeRemaining && !isWeekend() && (
                    <div className="flex items-center gap-2 text-sm font-medium text-primary">
                      <Clock className="w-4 h-4" />
                      {timeRemaining}
                    </div>
                  )}
                  {/* Streak Counter */}
                  <div className="flex items-center gap-2 bg-gradient-to-r from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 px-3 py-1.5 rounded-lg border border-orange-200 dark:border-orange-800">
                    <span className="text-xl">🔥</span>
                    <div className="text-sm">
                      <span className="font-bold text-orange-600">{streak}</span>
                      <span className="text-muted-foreground ml-1">day streak</span>
                    </div>
                    {streak >= 30 && <span className="ml-1">🏆</span>}
                    {streak >= 7 && streak < 30 && <span className="ml-1">⭐</span>}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 border rounded-lg">
                {todayStatus === "submitted" && (
                  <>
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-600">Submitted</p>
                      <p className="text-sm text-muted-foreground">
                        Submitted at {submittedAt ? formatSubmittedTime(submittedAt) : "N/A"}
                      </p>
                    </div>
                  </>
                )}
                {todayStatus === "pending" && (
                  <>
                    <Clock className="w-6 h-6 text-yellow-600" />
                    <div>
                      <p className="font-medium text-yellow-600">Pending</p>
                      <p className="text-sm text-muted-foreground">Please submit your standup</p>
                    </div>
                  </>
                )}
                {todayStatus === "missed" && (
                  <>
                    <XCircle className="w-6 h-6 text-red-600" />
                    <div>
                      <p className="font-medium text-red-600">Missed</p>
                      <p className="text-sm text-muted-foreground">Submission window closed</p>
                    </div>
                  </>
                )}
                {todayStatus === "on_leave" && (
                  <>
                    <Palmtree className="w-6 h-6 text-blue-600" />
                    <div>
                      <p className="font-medium text-blue-600">On Leave</p>
                      <p className="text-sm text-muted-foreground">Approved leave request</p>
                    </div>
                  </>
                )}
                {todayStatus === "weekend" && (
                  <>
                    <Calendar className="w-6 h-6 text-primary" />
                    <div>
                      <p className="font-medium text-primary">Weekend</p>
                      <p className="text-sm text-muted-foreground">No submission required</p>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Weekend Message */}
          {isWeekend() && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <Calendar className="w-16 h-16 mx-auto text-primary/60 mb-4" />
                  <h3 className="text-xl font-semibold mb-2">Enjoy Your Weekend! 🎉</h3>
                  <p className="text-muted-foreground mb-4">
                    Daily standups are not required on weekends.
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Next submission window: Monday, 8:00 AM - 10:00 AM
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Submission Form */}
          {canSubmit && !isWeekend() && (
            <Card>
              <CardHeader>
                <CardTitle>Submit Daily Standup</CardTitle>
                <CardDescription>Choose your preferred submission method</CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={submissionMode} onValueChange={(v) => setSubmissionMode(v as SubmissionMode)}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="text">
                      <FileText className="w-4 h-4 mr-2" />
                      Text
                    </TabsTrigger>
                    <TabsTrigger value="audio">
                      <Mic className="w-4 h-4 mr-2" />
                      Audio
                    </TabsTrigger>
                    <TabsTrigger value="image">
                      <ImageIcon className="w-4 h-4 mr-2" />
                      Image
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="text" className="space-y-4 mt-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">What did you accomplish yesterday?</label>
                      <Textarea
                        value={standupData.yesterday_work}
                        onChange={(e) => setStandupData({ ...standupData, yesterday_work: e.target.value })}
                        placeholder="Describe your accomplishments..."
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground text-right">{standupData.yesterday_work.length} characters</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">What are you working on today?</label>
                      <Textarea
                        value={standupData.today_plan}
                        onChange={(e) => setStandupData({ ...standupData, today_plan: e.target.value })}
                        placeholder="Describe your plan for today..."
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground text-right">{standupData.today_plan.length} characters</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Any blockers or issues?</label>
                      <Textarea
                        value={standupData.blockers}
                        onChange={(e) => setStandupData({ ...standupData, blockers: e.target.value })}
                        placeholder="List any blockers or challenges..."
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground text-right">{standupData.blockers.length} characters</p>
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium">Next steps?</label>
                      <Textarea
                        value={standupData.next_steps}
                        onChange={(e) => setStandupData({ ...standupData, next_steps: e.target.value })}
                        placeholder="What are your next steps..."
                        rows={2}
                      />
                      <p className="text-xs text-muted-foreground text-right">{standupData.next_steps.length} characters</p>
                    </div>

                    <Button
                      onClick={handleTextSubmit}
                      disabled={!standupData.yesterday_work || !standupData.today_plan || !standupData.blockers || !standupData.next_steps || submitting}
                      className="w-full"
                    >
                      {submitting ? "Submitting..." : "Submit Standup"}
                    </Button>
                  </TabsContent>

                  <TabsContent value="audio" className="space-y-4 mt-4">
                    {/* Audio Instructions */}
                    <Collapsible open={showAudioInstructions} onOpenChange={setShowAudioInstructions}>
                      <div className="bg-primary/5 border border-primary/20 rounded-lg p-5 mb-4">
                        <div className="flex items-start gap-3">
                          <Mic className="w-6 h-6 text-primary mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-primary mb-2">
                                📝 What to Include in Your Recording
                              </h4>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-primary">
                                  {showAudioInstructions ? (
                                    <>Hide <ChevronUp className="w-4 h-4 ml-1" /></>
                                  ) : (
                                    <>Show <ChevronDown className="w-4 h-4 ml-1" /></>
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent>
                              <ul className="space-y-2 text-sm text-muted-foreground">
                                <li className="flex items-start gap-2">
                                  <span className="font-semibold text-primary">1.</span>
                                  <span><strong>Yesterday:</strong> What did you accomplish yesterday?</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <span className="font-semibold text-primary">2.</span>
                                  <span><strong>Today:</strong> What are you working on today?</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <span className="font-semibold text-primary">3.</span>
                                  <span><strong>Blockers:</strong> Any blockers or issues you're facing?</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <span className="font-semibold text-primary">4.</span>
                                  <span><strong>Next Steps:</strong> What are your next steps?</span>
                                </li>
                              </ul>
                              <p className="text-xs text-primary/70 mt-3">
                                💡 Tip: Speak clearly and cover all 4 points. Recording will be processed by AI to extract these details.
                              </p>
                            </CollapsibleContent>
                          </div>
                        </div>
                      </div>
                    </Collapsible>

                    <div className="bg-muted p-6 rounded-lg text-center space-y-4">
                      {!isRecording && !audioBlob && (
                        <>
                          <Mic className="w-16 h-16 mx-auto text-primary" />
                          <p className="text-sm text-muted-foreground">Click to start recording (max 5 minutes)</p>
                          <Button onClick={startRecording} size="lg">
                            <Mic className="w-4 h-4 mr-2" />
                            Start Recording
                          </Button>
                        </>
                      )}

                      {isRecording && (
                        <>
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-lg font-medium">Recording...</span>
                          </div>
                          <div className="text-3xl font-mono">{formatTime(recordingDuration)}</div>
                          <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all duration-300"
                              style={{ width: `${(recordingDuration / 300) * 100}%` }}
                            />
                          </div>
                          <Button onClick={stopRecording} variant="destructive" size="lg">
                            Stop Recording
                          </Button>
                        </>
                      )}

                      {audioBlob && !isRecording && (
                        <>
                          <CheckCircle className="w-16 h-16 mx-auto text-green-600" />
                          <p className="text-sm text-muted-foreground">Recording complete ({formatTime(recordingDuration)})</p>
                          <div className="flex gap-2 justify-center">
                            <Button onClick={playAudio} variant="outline">
                              {isPlaying ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                              {isPlaying ? "Pause" : "Play"}
                            </Button>
                            <Button onClick={reRecord} variant="outline">
                              <RotateCcw className="w-4 h-4 mr-2" />
                              Re-record
                            </Button>
                          </div>
                        </>
                      )}
                    </div>

                    {audioBlob && (
                      <>
                        <p className="text-xs text-muted-foreground text-center">
                          AI will extract your standup details from the recording
                        </p>
                        <Button onClick={handleAudioSubmit} disabled={submitting} className="w-full">
                          {submitting ? "Processing..." : "Submit Audio Standup"}
                        </Button>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="image" className="space-y-4 mt-4">
                    {/* Image Instructions */}
                    <Collapsible open={showImageInstructions} onOpenChange={setShowImageInstructions}>
                      <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-lg p-5 mb-4">
                        <div className="flex items-start gap-3">
                          <ImageIcon className="w-6 h-6 text-purple-600 mt-0.5 shrink-0" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-purple-900 dark:text-purple-200 mb-2">
                                📸 What Your Image Should Contain
                              </h4>
                              <CollapsibleTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-purple-600">
                                  {showImageInstructions ? (
                                    <>Hide <ChevronUp className="w-4 h-4 ml-1" /></>
                                  ) : (
                                    <>Show <ChevronDown className="w-4 h-4 ml-1" /></>
                                  )}
                                </Button>
                              </CollapsibleTrigger>
                            </div>
                            <CollapsibleContent>
                              <p className="text-sm text-purple-800 dark:text-purple-300 mb-3">
                                Upload a clear image (screenshot, photo, or document) that includes:
                              </p>
                              <ul className="space-y-2 text-sm text-purple-800 dark:text-purple-300">
                                <li className="flex items-start gap-2">
                                  <Check className="w-4 h-4 mt-0.5 text-purple-600 shrink-0" />
                                  <span><strong>Yesterday's work:</strong> What you completed</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <Check className="w-4 h-4 mt-0.5 text-purple-600 shrink-0" />
                                  <span><strong>Today's plan:</strong> What you're working on</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <Check className="w-4 h-4 mt-0.5 text-purple-600 shrink-0" />
                                  <span><strong>Blockers:</strong> Any issues or obstacles</span>
                                </li>
                                <li className="flex items-start gap-2">
                                  <Check className="w-4 h-4 mt-0.5 text-purple-600 shrink-0" />
                                  <span><strong>Next steps:</strong> Your upcoming tasks</span>
                                </li>
                              </ul>
                              <p className="text-xs text-purple-600 dark:text-purple-400 mt-3">
                                💡 Tip: Ensure text is legible. Our AI will read and extract the information automatically.
                              </p>
                            </CollapsibleContent>
                          </div>
                        </div>
                      </div>
                    </Collapsible>

                    <div className="border-2 border-dashed border-border rounded-lg p-8 text-center space-y-4">
                      {!imagePreview ? (
                        <>
                          <Upload className="w-16 h-16 mx-auto text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium mb-1">Upload your standup image</p>
                            <p className="text-xs text-muted-foreground">JPG or PNG only, max 5MB</p>
                          </div>
                          <label>
                            <input
                              type="file"
                              accept=".jpg,.jpeg,.png"
                              onChange={handleImageSelect}
                              className="hidden"
                            />
                            <Button asChild>
                              <span>
                                <Upload className="w-4 h-4 mr-2" />
                                Choose Image
                              </span>
                            </Button>
                          </label>
                        </>
                      ) : (
                        <>
                          <img src={imagePreview} alt="Preview" className="max-h-64 mx-auto rounded-lg" />
                          <Button
                            onClick={() => {
                              setImageFile(null);
                              setImagePreview(null);
                            }}
                            variant="outline"
                          >
                            Change Image
                          </Button>
                        </>
                      )}
                    </div>

                    {imageFile && (
                      <>
                        <p className="text-xs text-muted-foreground text-center">
                          AI will extract your standup details from the image
                        </p>
                        <Button onClick={handleImageSubmit} disabled={submitting} className="w-full">
                          {submitting ? "Processing..." : "Submit Image Standup"}
                        </Button>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          )}

          {!canSubmit && todayStatus !== "submitted" && todayStatus !== "on_leave" && (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <XCircle className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Submission Window Closed</h3>
                  <p className="text-sm text-muted-foreground">
                    Next window: Tomorrow 8:00 AM - 10:00 AM
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent History */}
          <Card>
            <CardHeader>
              <CardTitle>Recent History</CardTitle>
              <CardDescription>Last 7 days of standups</CardDescription>
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No standup history yet
                </div>
              ) : (
                <div className="space-y-2">
                  {history.map((item) => (
                    <div key={item.id} className="border rounded-lg">
                      <div
                        className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50"
                        onClick={() => setExpandedHistory(expandedHistory === item.id ? null : item.id)}
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-sm font-medium">{formatDate(item.date)}</div>
                          {item.status === "submitted" ? (
                            <div className="flex items-center gap-2 text-sm text-green-600">
                              <CheckCircle className="w-4 h-4" />
                              Submitted
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 text-sm text-red-600">
                              <XCircle className="w-4 h-4" />
                              Missed
                            </div>
                          )}
                          {item.submitted_at && (
                            <div className="text-xs text-muted-foreground">
                              at {formatSubmittedTime(item.submitted_at)}
                            </div>
                          )}
                        </div>
                        <Button variant="ghost" size="sm">
                          {expandedHistory === item.id ? "Hide Details" : "View Details"}
                        </Button>
                      </div>
                      {expandedHistory === item.id && (
                        <div className="p-4 border-t bg-muted/20 space-y-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Yesterday's Work:</p>
                            <p className="text-sm">{item.yesterday_work || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Today's Plan:</p>
                            <p className="text-sm">{item.today_plan || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Blockers:</p>
                            <p className="text-sm">{item.blockers || "N/A"}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Next Steps:</p>
                            <p className="text-sm">{item.next_steps || "N/A"}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default MemberDashboard;
