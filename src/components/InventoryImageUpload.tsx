import React, { useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InventoryImageUploadProps {
  onUploadStart: () => void;
  onUploadComplete: (success: boolean, errorMessage?: string) => void;
}

const InventoryImageUpload: React.FC<InventoryImageUploadProps> = ({
  onUploadStart,
  onUploadComplete,
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: 'Invalid file',
        description: 'Please upload an image file.',
        variant: 'destructive',
      });
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 10MB.',
        variant: 'destructive',
      });
      return;
    }

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    // Upload
    setIsLoading(true);
    onUploadStart();

    try {
      const { addInventoryViaImage } = await import('@/services/inventoryImageService');
      if (!user) {
        throw new Error('User not authenticated');
      }

      await addInventoryViaImage(user.uid, file);
      
      toast({
        title: 'Processing image...',
        description: 'Your inventory is being updated.',
      });

      onUploadComplete(true);
    } catch (error) {
      console.error('Image upload error:', error);
      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Failed to process image.',
        variant: 'destructive',
      });
      onUploadComplete(false, error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setIsLoading(false);
      setPreview(null);
    }
  };

  return (
    <Card className="magnet-card border-2 border-dashed">
      <CardContent className="p-6">
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'rounded-lg border-2 border-dashed p-8 text-center transition-colors',
            isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25',
            isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'
          )}
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            disabled={isLoading}
            className="hidden"
          />

          {preview ? (
            <div className="space-y-2">
              <img src={preview} alt="Preview" className="h-32 w-32 object-cover rounded mx-auto" />
              <p className="text-sm text-muted-foreground">Image selected</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
              <p className="text-sm font-medium">Drag image here or click to upload</p>
              <p className="text-xs text-muted-foreground">PNG, JPG, GIF up to 10MB</p>
            </div>
          )}

          {isLoading && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Processing...</span>
            </div>
          )}
        </div>

        {preview && !isLoading && (
          <div className="mt-4 flex gap-2">
            <Button
              onClick={() => setPreview(null)}
              variant="outline"
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const input = fileInputRef.current;
                if (input?.files?.[0]) {
                  processFile(input.files[0]);
                }
              }}
              className="flex-1"
              disabled={isLoading}
            >
              Upload
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InventoryImageUpload;
