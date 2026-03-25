import React, { useState, useCallback } from 'react';
import Cropper from 'react-easy-crop';
import { Camera, Loader2, X, ZoomIn, ZoomOut, Check } from 'lucide-react';
import { Modal } from '../Modal';
import { useAuthStore } from '../../context/authStore';
import { usersService } from '../../services/api';
import { UserAvatar } from '../UserAvatar';
import { cn } from '../../utils/helpers';

interface ProfilePhotoUploadProps {
  size?: 'md' | 'lg' | 'xl';
  className?: string;
}

export const ProfilePhotoUpload: React.FC<ProfilePhotoUploadProps> = ({ size = 'xl', className }) => {
  const { user, updateUser } = useAuthStore();
  const [image, setImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [isModaling, setIsModaling] = useState(false);
  const [uploading, setUploading] = useState(false);

  const onCropComplete = useCallback((_croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.addEventListener('load', () => {
        setImage(reader.result as string);
        setIsModaling(true);
      });
      reader.readAsDataURL(file);
    }
  };

  const createImage = (url: string): Promise<HTMLImageElement> =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.setAttribute('crossOrigin', 'anonymous');
      image.src = url;
    });

  const getCroppedImg = async (imageSrc: string, pixelCrop: any): Promise<Blob | null> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) return null;

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/jpeg', 0.9);
    });
  };

  const handleSave = async () => {
    if (!image || !croppedAreaPixels) return;
    setUploading(true);
    try {
      const croppedBlob = await getCroppedImg(image, croppedAreaPixels);
      if (croppedBlob) {
        const file = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });
        const res = await usersService.updateProfilePhoto(file);
        if (res.data?.success) {
          updateUser({ avatar: res.data.data.avatar });
          setIsModaling(false);
        }
      }
    } catch (error) {
      console.error('Failed to upload profile photo:', error);
    } finally {
      setUploading(false);
    }
  };

  if (!user) return null;

  return (
    <div className={cn("relative group", className)}>
      <UserAvatar 
        name={user.name} 
        avatar={user.avatar} 
        color={user.color} 
        size={size} 
        className="ring-4 ring-white dark:ring-surface-900 shadow-lg"
      />
      
      <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 cursor-pointer transition-all duration-250 backdrop-blur-[2px]">
        <input type="file" className="hidden" accept="image/*" onChange={handleFileChange} />
        {uploading ? (
          <Loader2 size={20} className="animate-spin" />
        ) : (
          <div className="flex flex-col items-center gap-1 scale-90 group-hover:scale-100 transition-transform">
            <Camera size={20} />
            <span className="text-[10px] font-bold uppercase tracking-wider">Change</span>
          </div>
        )}
      </label>

      <Modal
        open={isModaling}
        onClose={() => setIsModaling(false)}
        title="Edit Profile Photo"
        size="md"
      >
        <div className="p-6">
          <div className="relative h-80 w-full bg-surface-100 dark:bg-surface-800 rounded-2xl overflow-hidden ring-1 ring-black/5 shadow-inner">
            {image && (
              <Cropper
                image={image}
                crop={crop}
                zoom={zoom}
                aspect={1}
                onCropChange={setCrop}
                onCropComplete={onCropComplete}
                onZoomChange={setZoom}
                cropShape="round"
                showGrid={false}
              />
            )}
          </div>
          
          <div className="mt-8 space-y-6">
            <div className="flex items-center gap-4 bg-surface-50 dark:bg-surface-950/40 p-4 rounded-2xl border border-surface-100 dark:border-surface-800">
              <ZoomOut size={16} className="text-surface-400" />
              <input
                type="range"
                value={zoom}
                min={1}
                max={3}
                step={0.1}
                aria-labelledby="Zoom"
                onChange={(e) => setZoom(Number(e.target.value))}
                className="flex-1 accent-brand-600 h-1.5 bg-surface-200 dark:bg-surface-800 rounded-full cursor-pointer"
              />
              <ZoomIn size={16} className="text-surface-400" />
            </div>
            
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-surface-100 dark:border-surface-800">
              <button
                onClick={() => setIsModaling(false)}
                className="btn-ghost btn-md px-6 hover:bg-surface-100 dark:hover:bg-surface-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={uploading}
                className="btn-primary btn-md px-8 shadow-lg shadow-brand-600/20"
              >
                {uploading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <><Check size={16} /> Save Changes</>
                )}
              </button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
