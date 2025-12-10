import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  CheckCircle, XCircle, FileText, Mic, 
  Image as ImageIcon, Upload, Play, Pause, RotateCcw, ChevronDown, 
  ChevronUp, Check, Calendar
} from "lucide-react";

type SubmissionMode = "text" | "audio" | "image";

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

interface SubmissionsViewProps {
  canSubmit: boolean;
  isWeekend: boolean;
  todayStatus: string;
  submissionMode: SubmissionMode;
  setSubmissionMode: (mode: SubmissionMode) => void;
  standupData: StandupData;
  setStandupData: (data: StandupData) => void;
  submitting: boolean;
  handleTextSubmit: () => void;
  // Audio props
  isRecording: boolean;
  audioBlob: Blob | null;
  recordingDuration: number;
  isPlaying: boolean;
  startRecording: () => void;
  stopRecording: () => void;
  playAudio: () => void;
  reRecord: () => void;
  handleAudioSubmit: () => void;
  formatTime: (seconds: number) => string;
  showAudioInstructions: boolean;
  setShowAudioInstructions: (show: boolean) => void;
  // Image props
  imageFile: File | null;
  imagePreview: string | null;
  handleImageSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleImageSubmit: () => void;
  clearImage: () => void;
  showImageInstructions: boolean;
  setShowImageInstructions: (show: boolean) => void;
  // History props
  history: HistoryItem[];
  expandedHistory: string | null;
  setExpandedHistory: (id: string | null) => void;
  formatDate: (date: string) => string;
  formatSubmittedTime: (timestamp: string) => string;
}

const SubmissionsView = ({
  canSubmit,
  isWeekend,
  todayStatus,
  submissionMode,
  setSubmissionMode,
  standupData,
  setStandupData,
  submitting,
  handleTextSubmit,
  isRecording,
  audioBlob,
  recordingDuration,
  isPlaying,
  startRecording,
  stopRecording,
  playAudio,
  reRecord,
  handleAudioSubmit,
  formatTime,
  showAudioInstructions,
  setShowAudioInstructions,
  imageFile,
  imagePreview,
  handleImageSelect,
  handleImageSubmit,
  clearImage,
  showImageInstructions,
  setShowImageInstructions,
  history,
  expandedHistory,
  setExpandedHistory,
  formatDate,
  formatSubmittedTime,
}: SubmissionsViewProps) => {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Submissions</h2>
        <p className="text-muted-foreground">Submit your daily standup and view history</p>
      </div>

      {/* Weekend Message */}
      {isWeekend && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <Calendar className="w-14 h-14 mx-auto text-primary/60 mb-4" />
              <h3 className="text-xl font-semibold mb-2">Enjoy Your Weekend! 🎉</h3>
              <p className="text-muted-foreground mb-2">
                Daily standups are not required on weekends.
              </p>
              <p className="text-sm text-muted-foreground">
                Next window: Monday, 8:00 AM - 10:00 AM
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Submission Form */}
      {canSubmit && !isWeekend && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Submit Daily Standup</CardTitle>
            <CardDescription>Choose your preferred submission method</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={submissionMode} onValueChange={(v) => setSubmissionMode(v as SubmissionMode)}>
              <TabsList className="grid w-full grid-cols-3 mb-6">
                <TabsTrigger value="text" className="gap-2">
                  <FileText className="w-4 h-4" />
                  <span className="hidden sm:inline">Text</span>
                </TabsTrigger>
                <TabsTrigger value="audio" className="gap-2">
                  <Mic className="w-4 h-4" />
                  <span className="hidden sm:inline">Audio</span>
                </TabsTrigger>
                <TabsTrigger value="image" className="gap-2">
                  <ImageIcon className="w-4 h-4" />
                  <span className="hidden sm:inline">Image</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="text" className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Yesterday's accomplishments</label>
                    <Textarea
                      value={standupData.yesterday_work}
                      onChange={(e) => setStandupData({ ...standupData, yesterday_work: e.target.value })}
                      placeholder="What did you accomplish?"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Today's plan</label>
                    <Textarea
                      value={standupData.today_plan}
                      onChange={(e) => setStandupData({ ...standupData, today_plan: e.target.value })}
                      placeholder="What are you working on?"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Blockers</label>
                    <Textarea
                      value={standupData.blockers}
                      onChange={(e) => setStandupData({ ...standupData, blockers: e.target.value })}
                      placeholder="Any blockers or issues?"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Next steps</label>
                    <Textarea
                      value={standupData.next_steps}
                      onChange={(e) => setStandupData({ ...standupData, next_steps: e.target.value })}
                      placeholder="What are your next steps?"
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>
                <Button onClick={handleTextSubmit} disabled={submitting} className="w-full">
                  {submitting ? "Submitting..." : "Submit Standup"}
                </Button>
              </TabsContent>

              <TabsContent value="audio" className="space-y-4">
                <Collapsible open={showAudioInstructions} onOpenChange={setShowAudioInstructions}>
                  <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <Mic className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-blue-900 dark:text-blue-200 text-sm">
                            Recording Tips
                          </h4>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-blue-600 h-7 px-2">
                              {showAudioInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          <ul className="mt-2 space-y-1.5 text-sm text-blue-800 dark:text-blue-300">
                            <li>1. Yesterday's accomplishments</li>
                            <li>2. Today's plan</li>
                            <li>3. Any blockers</li>
                            <li>4. Next steps</li>
                          </ul>
                        </CollapsibleContent>
                      </div>
                    </div>
                  </div>
                </Collapsible>

                <div className="bg-muted/50 p-6 rounded-xl text-center space-y-4">
                  {!isRecording && !audioBlob && (
                    <>
                      <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                        <Mic className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">Click to start recording (max 5 min)</p>
                      <Button onClick={startRecording} size="lg" className="gap-2">
                        <Mic className="w-4 h-4" />
                        Start Recording
                      </Button>
                    </>
                  )}

                  {isRecording && (
                    <>
                      <div className="flex items-center justify-center gap-2">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
                        <span className="font-medium">Recording...</span>
                      </div>
                      <div className="text-3xl font-mono">{formatTime(recordingDuration)}</div>
                      <div className="w-full h-2 bg-background rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all"
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
                      <div className="w-16 h-16 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">Recording complete ({formatTime(recordingDuration)})</p>
                      <div className="flex gap-2 justify-center">
                        <Button onClick={playAudio} variant="outline" size="sm" className="gap-2">
                          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                          {isPlaying ? "Pause" : "Play"}
                        </Button>
                        <Button onClick={reRecord} variant="outline" size="sm" className="gap-2">
                          <RotateCcw className="w-4 h-4" />
                          Re-record
                        </Button>
                      </div>
                    </>
                  )}
                </div>

                {audioBlob && (
                  <Button onClick={handleAudioSubmit} disabled={submitting} className="w-full">
                    {submitting ? "Processing..." : "Submit Audio Standup"}
                  </Button>
                )}
              </TabsContent>

              <TabsContent value="image" className="space-y-4">
                <Collapsible open={showImageInstructions} onOpenChange={setShowImageInstructions}>
                  <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <ImageIcon className="w-5 h-5 text-purple-600 mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-purple-900 dark:text-purple-200 text-sm">
                            Image Requirements
                          </h4>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-purple-600 h-7 px-2">
                              {showImageInstructions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent>
                          <ul className="mt-2 space-y-1.5 text-sm text-purple-800 dark:text-purple-300">
                            <li className="flex items-center gap-2">
                              <Check className="w-3 h-3" /> Yesterday's work
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3 h-3" /> Today's plan
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3 h-3" /> Blockers
                            </li>
                            <li className="flex items-center gap-2">
                              <Check className="w-3 h-3" /> Next steps
                            </li>
                          </ul>
                        </CollapsibleContent>
                      </div>
                    </div>
                  </div>
                </Collapsible>

                <div className="border-2 border-dashed border-border rounded-xl p-6 text-center space-y-4">
                  {!imagePreview ? (
                    <>
                      <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center">
                        <Upload className="w-7 h-7 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium mb-1">Upload your standup image</p>
                        <p className="text-xs text-muted-foreground">JPG or PNG, max 5MB</p>
                      </div>
                      <label>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                        <Button asChild variant="outline">
                          <span className="gap-2">
                            <Upload className="w-4 h-4" />
                            Choose Image
                          </span>
                        </Button>
                      </label>
                    </>
                  ) : (
                    <>
                      <img src={imagePreview} alt="Preview" className="max-h-48 mx-auto rounded-lg" />
                      <Button onClick={clearImage} variant="outline" size="sm">
                        Change Image
                      </Button>
                    </>
                  )}
                </div>

                {imageFile && (
                  <Button onClick={handleImageSubmit} disabled={submitting} className="w-full">
                    {submitting ? "Processing..." : "Submit Image Standup"}
                  </Button>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Submission Window Closed */}
      {!canSubmit && todayStatus !== "submitted" && todayStatus !== "on_leave" && !isWeekend && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-muted flex items-center justify-center mb-4">
                <XCircle className="w-7 h-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">Submission Window Closed</h3>
              <p className="text-sm text-muted-foreground">
                Next window: Tomorrow 8:00 AM - 10:00 AM
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Already Submitted */}
      {todayStatus === "submitted" && (
        <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="pt-6">
            <div className="text-center py-6">
              <div className="w-14 h-14 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-4">
                <CheckCircle className="w-7 h-7 text-green-600" />
              </div>
              <h3 className="text-lg font-semibold text-green-700 dark:text-green-400 mb-2">
                Today's Standup Submitted
              </h3>
              <p className="text-sm text-muted-foreground">
                Great job! Check your history below.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent History</CardTitle>
          <CardDescription>Last 7 days of submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {history.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No standup history yet
            </div>
          ) : (
            <div className="space-y-2">
              {history.map((item) => (
                <div key={item.id} className="border rounded-xl overflow-hidden">
                  <div
                    className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => setExpandedHistory(expandedHistory === item.id ? null : item.id)}
                  >
                    <div className="flex items-center gap-4">
                      <div className="text-sm font-medium">{formatDate(item.date)}</div>
                      {item.status === "submitted" ? (
                        <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-100 dark:bg-green-900/30 px-2 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" />
                          Submitted
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-100 dark:bg-red-900/30 px-2 py-1 rounded-full">
                          <XCircle className="w-3 h-3" />
                          Missed
                        </div>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs">
                      {expandedHistory === item.id ? "Hide" : "View"}
                    </Button>
                  </div>
                  {expandedHistory === item.id && (
                    <div className="p-4 border-t bg-muted/30 grid sm:grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Yesterday</p>
                        <p className="text-sm">{item.yesterday_work || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Today</p>
                        <p className="text-sm">{item.today_plan || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Blockers</p>
                        <p className="text-sm">{item.blockers || "N/A"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Next Steps</p>
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
  );
};

export default SubmissionsView;