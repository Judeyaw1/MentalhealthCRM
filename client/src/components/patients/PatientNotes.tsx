import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MessageSquare, Reply, Edit, Trash2, Send, X, Users, User, Trash, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface PatientNote {
  _id: string;
  content: string;
  authorName: string;
  authorId: string;
  createdAt: string;
  updatedAt: string;
  isPrivate: boolean;
  directedTo?: string | null;
  directedToName?: string | null;
  parentNoteId?: string | null;
}

interface Thread {
  threadId: string;
  directedTo?: string | null;
  directedToName?: string | null;
  isGeneral: boolean;
  notes: PatientNote[];
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
}

interface PatientNotesProps {
  patientId: string;
}

export default function PatientNotes({ patientId }: PatientNotesProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [newNote, setNewNote] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [directedTo, setDirectedTo] = useState<string | null>(null);
  const [directedToName, setDirectedToName] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [showCleanupStats, setShowCleanupStats] = useState(false);

  // Fetch notes (now returns threads)
  const { data: threads = [], isLoading } = useQuery({
    queryKey: ["notes", patientId],
    queryFn: async () => {
      const response = await fetch(`/api/patients/${patientId}/notes`);
      if (!response.ok) throw new Error("Failed to fetch notes");
      return response.json();
    },
  });

  // Fetch staff for directed notes
  const { data: staff = [] } = useQuery({
    queryKey: ["staff-list"],
    queryFn: async () => {
      const response = await fetch("/api/staff/list");
      if (!response.ok) throw new Error("Failed to fetch staff");
      return response.json();
    },
    enabled: user?.role === "admin" || user?.role === "therapist",
  });

  // Fetch cleanup stats (admin only)
  const { data: cleanupStats } = useQuery({
    queryKey: ["cleanup-stats"],
    queryFn: async () => {
      const response = await fetch("/api/notes/cleanup-stats");
      if (!response.ok) throw new Error("Failed to fetch cleanup stats");
      return response.json();
    },
    enabled: user?.role === "admin" && showCleanupStats,
  });

  // Cleanup mutation
  const cleanupMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/notes/cleanup", {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to cleanup old notes");
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Cleanup Complete",
        description: data.message,
      });
      queryClient.invalidateQueries({ queryKey: ["cleanup-stats"] });
      queryClient.invalidateQueries({ queryKey: ["notes", patientId] });
    },
    onError: (error) => {
      toast({
        title: "Cleanup Failed",
        description: error.message || "Failed to cleanup old notes",
        variant: "destructive",
      });
    },
  });

  // Add new note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ content, isPrivate, directedTo, directedToName, parentNoteId }: {
      content: string;
      isPrivate: boolean;
      directedTo: string | null;
      directedToName: string | null;
      parentNoteId?: string | null;
    }) => {
      const response = await fetch(`/api/patients/${patientId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, isPrivate, directedTo, directedToName, parentNoteId }),
      });
      if (!response.ok) throw new Error("Failed to add note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", patientId] });
      setNewNote("");
      setIsPrivate(false);
      setDirectedTo(null);
      setDirectedToName(null);
      setReplyingTo(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add note",
        variant: "destructive",
      });
    },
  });

  // Edit note mutation
  const editNoteMutation = useMutation({
    mutationFn: async ({ noteId, content }: { noteId: string; content: string }) => {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!response.ok) throw new Error("Failed to edit note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", patientId] });
      setEditingNote(null);
      setEditContent("");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to edit note",
        variant: "destructive",
      });
    },
  });

  // Delete note mutation
  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to delete note");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes", patientId] });
      toast({
        title: "Success",
        description: "Note deleted successfully",
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete note",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;
    
    // If this is a reply, don't send directedTo/directedToName - backend will inherit from parent
    const isReply = replyingTo !== null;
    
    addNoteMutation.mutate({
      content: newNote.trim(),
      isPrivate,
      directedTo: isReply ? null : directedTo,
      directedToName: isReply ? null : directedToName,
      parentNoteId: replyingTo || undefined,
    });
  };

  const handleEdit = (noteId: string, currentContent: string) => {
    setEditingNote(noteId);
    setEditContent(currentContent);
  };

  const handleEditSubmit = (noteId: string) => {
    if (!editContent.trim()) return;
    
    editNoteMutation.mutate({
      noteId,
      content: editContent.trim(),
    });
  };

  const handleDelete = (noteId: string) => {
    if (confirm("Are you sure you want to delete this note?")) {
      deleteNoteMutation.mutate(noteId);
    }
  };

  const canEditNote = (note: PatientNote) => {
    return user?.id === note.authorId || user?.role === "admin";
  };

  const canDeleteNote = (note: PatientNote) => {
    return user?.id === note.authorId || user?.role === "admin";
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin": return "bg-red-100 text-red-800";
      case "therapist": return "bg-blue-100 text-blue-800";
      case "staff": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleDirectedToChange = (value: string) => {
    if (value === "general") {
      setDirectedTo(null);
      setDirectedToName(null);
    } else {
      const selectedStaff = staff.find((s: StaffMember) => s.id === value);
      setDirectedTo(value);
      setDirectedToName(selectedStaff ? `${selectedStaff.firstName} ${selectedStaff.lastName}` : null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">Loading notes...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Notes
          </div>
          {user?.role === "admin" && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowCleanupStats(!showCleanupStats)}
              >
                <Clock className="h-4 w-4 mr-2" />
                Cleanup
              </Button>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cleanup stats (admin only) */}
        {user?.role === "admin" && showCleanupStats && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-medium text-blue-900">Notes Cleanup</h3>
              <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                Auto-cleanup: Every 6 hours
              </Badge>
            </div>
            {cleanupStats ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Total notes:</span>
                  <span className="font-medium">{cleanupStats.totalNotesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Notes older than 24h:</span>
                  <span className="font-medium text-orange-600">{cleanupStats.oldNotesCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Will be cleaned:</span>
                  <span className="font-medium text-red-600">{cleanupStats.willBeCleaned}</span>
                </div>
                <div className="pt-2">
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => cleanupMutation.mutate()}
                    disabled={cleanupMutation.isPending || cleanupStats.oldNotesCount === 0}
                  >
                    <Trash className="h-4 w-4 mr-2" />
                    {cleanupMutation.isPending ? "Cleaning..." : `Clean ${cleanupStats.oldNotesCount} Old Notes`}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-sm text-blue-700">Loading cleanup stats...</div>
            )}
          </div>
        )}

        {/* New note form */}
        {user?.role !== "frontdesk" && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Write a note..."
                className="min-h-[100px]"
              />
            </div>
            
            <div className="flex flex-wrap gap-4 items-center">
              {/* Direct to dropdown */}
              {(user?.role === "admin" || user?.role === "supervisor" || user?.role === "therapist") && (
                <div className="flex items-center gap-2">
                  <Select value={directedTo || "general"} onValueChange={handleDirectedToChange}>
                    <SelectTrigger className="w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          General Note (Everyone)
                        </div>
                      </SelectItem>
                      {staff.map((member: StaffMember) => (
                        <SelectItem key={member.id} value={member.id}>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            {member.firstName} {member.lastName} ({member.role})
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Private toggle */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="private"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="private" className="text-sm">Private</label>
              </div>

              <Button
                type="submit"
                disabled={addNoteMutation.isPending || !newNote.trim()}
              >
                <Send className="h-4 w-4 mr-2" />
                Add Note
              </Button>
            </div>
          </form>
        )}

        {/* Threads */}
        <div className="space-y-6">
          {threads.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No notes yet. Start the conversation!
            </div>
          ) : (
            threads.map((thread: Thread) => (
              <div key={thread.threadId} className="space-y-3">
                {/* Thread header */}
                <div className="flex items-center gap-2">
                  {thread.isGeneral ? (
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      <Users className="h-3 w-3 mr-1" />
                      General Thread
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                      <User className="h-3 w-3 mr-1" />
                      To: {thread.directedToName}
                    </Badge>
                  )}
                </div>

                {/* Notes in thread */}
                <div className="space-y-3 ml-4">
                  {thread.notes.map((note: PatientNote) => (
                    <div key={note._id} className="space-y-2">
                      {/* Main note */}
                      <div className="flex gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs">
                            {getInitials(note.authorName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{note.authorName}</span>
                            <span className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(note.createdAt), { addSuffix: true })}
                            </span>
                            {note.isPrivate && (
                              <Badge variant="outline" className="text-xs">Private</Badge>
                            )}
                          </div>
                          
                          {editingNote === note._id ? (
                            <div className="space-y-2">
                              <Textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                placeholder="Edit your note..."
                                className="min-h-[60px]"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => handleEditSubmit(note._id)}
                                  disabled={editNoteMutation.isPending}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setEditingNote(null);
                                    setEditContent("");
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className={`rounded-lg p-3 ${
                              note.directedTo ? 'bg-purple-50 border-l-2 border-purple-200' : 'bg-gray-50'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap">{note.content}</p>
                            </div>
                          )}
                          
                          <div className="flex gap-2">
                            {user?.role !== "frontdesk" && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setReplyingTo(note._id)}
                              >
                                <Reply className="h-3 w-3 mr-1" />
                                Reply
                              </Button>
                            )}
                            {canEditNote(note) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(note._id, note.content)}
                              >
                                <Edit className="h-3 w-3 mr-1" />
                                Edit
                              </Button>
                            )}
                            {canDeleteNote(note) && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(note._id)}
                              >
                                <Trash2 className="h-3 w-3 mr-1" />
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Reply form */}
                      {replyingTo === note._id && (
                        <div className="ml-8 mt-2">
                          <form onSubmit={handleSubmit} className="space-y-2">
                            <Textarea
                              value={newNote}
                              onChange={(e) => setNewNote(e.target.value)}
                              placeholder="Write your reply..."
                              className="min-h-[60px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                type="submit"
                                size="sm"
                                disabled={addNoteMutation.isPending || !newNote.trim()}
                              >
                                <Send className="h-3 w-3 mr-1" />
                                Send Reply
                              </Button>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setReplyingTo(null)}
                              >
                                <X className="h-3 w-3 mr-1" />
                                Cancel
                              </Button>
                            </div>
                          </form>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
} 