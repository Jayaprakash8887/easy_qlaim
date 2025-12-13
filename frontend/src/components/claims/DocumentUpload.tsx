import { useState, useCallback } from "react";
import { Upload, X, FileText, Image, File, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  type: "image" | "pdf" | "other";
  status: "uploading" | "complete" | "error";
}

interface DocumentUploadProps {
  requiredDocs: string[];
  onFilesChange: (files: UploadedFile[]) => void;
}

export function DocumentUpload({ requiredDocs, onFilesChange }: DocumentUploadProps) {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);

  const getFileType = (fileName: string): "image" | "pdf" | "other" => {
    const ext = fileName.toLowerCase().split(".").pop();
    if (["jpg", "jpeg", "png", "gif", "webp"].includes(ext || "")) return "image";
    if (ext === "pdf") return "pdf";
    return "other";
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const droppedFiles = Array.from(e.dataTransfer.files);
      const newFiles: UploadedFile[] = droppedFiles.map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: formatFileSize(file.size),
        type: getFileType(file.name),
        status: "complete" as const,
      }));

      const updatedFiles = [...files, ...newFiles];
      setFiles(updatedFiles);
      onFilesChange(updatedFiles);
    },
    [files, onFilesChange]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const newFiles: UploadedFile[] = selectedFiles.map((file) => ({
      id: Math.random().toString(36).substr(2, 9),
      name: file.name,
      size: formatFileSize(file.size),
      type: getFileType(file.name),
      status: "complete" as const,
    }));

    const updatedFiles = [...files, ...newFiles];
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const removeFile = (id: string) => {
    const updatedFiles = files.filter((f) => f.id !== id);
    setFiles(updatedFiles);
    onFilesChange(updatedFiles);
  };

  const FileIcon = ({ type }: { type: UploadedFile["type"] }) => {
    switch (type) {
      case "image":
        return <Image className="h-4 w-4 text-accent" />;
      case "pdf":
        return <FileText className="h-4 w-4 text-destructive" />;
      default:
        return <File className="h-4 w-4 text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-foreground">Upload Documents</h4>
        <div className="flex gap-1">
          {requiredDocs.map((doc, idx) => (
            <span
              key={idx}
              className="inline-flex items-center rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
            >
              {doc}
            </span>
          ))}
        </div>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition-all",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50"
        )}
      >
        <input
          type="file"
          multiple
          onChange={handleFileInput}
          className="absolute inset-0 cursor-pointer opacity-0"
          accept=".pdf,.jpg,.jpeg,.png,.gif,.doc,.docx"
        />
        
        <div className={cn(
          "flex h-14 w-14 items-center justify-center rounded-full transition-colors",
          isDragging ? "bg-primary text-primary-foreground" : "bg-secondary"
        )}>
          <Upload className="h-6 w-6" />
        </div>
        
        <p className="mt-4 text-sm font-medium text-foreground">
          {isDragging ? "Drop files here" : "Drag & drop files here"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          or click to browse (PDF, Images, Documents)
        </p>
      </div>

      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file) => (
            <div
              key={file.id}
              className="flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-all hover:bg-secondary/30"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary">
                <FileIcon type={file.type} />
              </div>
              
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{file.size}</p>
              </div>
              
              {file.status === "complete" && (
                <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
              )}
              
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeFile(file.id)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
