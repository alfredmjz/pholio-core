"use client";

import { useState, useRef, useCallback } from "react";
import Cropper, { type Area } from "react-easy-crop";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import { toast } from "sonner";
import { uploadProfileAvatar } from "../actions";
import { Loader2, Upload, ZoomIn, ZoomOut, Image as ImageIcon } from "lucide-react";

interface ProfileAvatarUploadProps {
	currentAvatarUrl: string | null;
	currentInitials: string;
	isGuest: boolean;
}

export default function ProfileAvatarUpload({ currentAvatarUrl, currentInitials, isGuest }: ProfileAvatarUploadProps) {
	const [selectedFile, setSelectedFile] = useState<string | null>(null);
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [crop, setCrop] = useState({ x: 0, y: 0 });
	const [zoom, setZoom] = useState(1);
	const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
	const [isUploading, setIsUploading] = useState(false);

	const fileInputRef = useRef<HTMLInputElement>(null);

	const onCropComplete = useCallback((croppedArea: Area, croppedAreaPixels: Area) => {
		setCroppedAreaPixels(croppedAreaPixels);
	}, []);

	const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
		if (event.target.files && event.target.files.length > 0) {
			const file = event.target.files[0];

			// Validate file type
			if (!file.type.startsWith("image/")) {
				toast.error("Please select an image file");
				return;
			}

			// Validate file size (max 5MB)
			if (file.size > 5 * 1024 * 1024) {
				toast.error("Image must be smaller than 5MB");
				return;
			}

			const reader = new FileReader();
			reader.addEventListener("load", () => {
				setSelectedFile(reader.result as string);
				setIsDialogOpen(true);
				setZoom(1);
			});
			reader.readAsDataURL(file);
		}
		// Reset input so same file can be selected again if needed
		event.target.value = "";
	};

	const createImage = (url: string): Promise<HTMLImageElement> =>
		new Promise((resolve, reject) => {
			const image = new Image();
			image.addEventListener("load", () => resolve(image));
			image.addEventListener("error", (error) => reject(error));
			image.setAttribute("crossOrigin", "anonymous");
			image.src = url;
		});

	const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
		const image = await createImage(imageSrc);
		const canvas = document.createElement("canvas");
		const ctx = canvas.getContext("2d");

		if (!ctx) {
			throw new Error("No 2d context");
		}

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

		return new Promise((resolve, reject) => {
			canvas.toBlob((blob) => {
				if (!blob) {
					reject(new Error("Canvas is empty"));
					return;
				}
				resolve(blob);
			}, "image/png");
		});
	};

	const handleSave = async () => {
		if (!selectedFile || !croppedAreaPixels) return;

		try {
			setIsUploading(true);
			const croppedImageBlob = await getCroppedImg(selectedFile, croppedAreaPixels);

			const formData = new FormData();
			formData.append("avatar", croppedImageBlob);

			const result = await uploadProfileAvatar(formData);

			if (result.error) {
				toast.error(result.error);
			} else {
				toast.success("Profile picture updated");
				setIsDialogOpen(false);
				setSelectedFile(null);
			}
		} catch (error) {
			console.error(error);
			toast.error("Failed to process image");
		} finally {
			setIsUploading(false);
		}
	};

	const handleTriggerClick = () => {
		if (isGuest) {
			toast.error("Guest accounts cannot upload profile pictures");
			return;
		}
		fileInputRef.current?.click();
	};

	return (
		<>
			<div className="relative group cursor-pointer" onClick={handleTriggerClick}>
				<input
					type="file"
					accept="image/*"
					className="hidden"
					ref={fileInputRef}
					onChange={handleFileSelect}
					disabled={isGuest}
				/>

				{currentAvatarUrl ? (
					<div className="relative w-16 h-16 rounded-full overflow-hidden border border-border">
						<img
							src={currentAvatarUrl}
							alt="Profile"
							className="w-full h-full object-cover transition-opacity group-hover:opacity-70"
						/>
						{!isGuest && (
							<div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/30">
								<Upload className="w-5 h-5 text-white" />
							</div>
						)}
					</div>
				) : (
					<div className="relative w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xl font-semibold overflow-hidden">
						{currentInitials}
						{!isGuest && (
							<div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 flex items-center justify-center transition-all">
								<Upload className="w-5 h-5 text-white opacity-0 group-hover:opacity-100" />
							</div>
						)}
					</div>
				)}
			</div>

			<Dialog open={isDialogOpen} onOpenChange={(open) => !isUploading && setIsDialogOpen(open)}>
				<DialogContent className="sm:max-w-md">
					<DialogHeader>
						<DialogTitle>Update Profile Picture</DialogTitle>
						<DialogDescription>Drag to reposition. Use the slider to zoom.</DialogDescription>
					</DialogHeader>

					<div className="relative w-full h-64 bg-black/5 rounded-md overflow-hidden mt-2">
						{selectedFile && (
							<Cropper
								image={selectedFile}
								crop={crop}
								zoom={zoom}
								aspect={1}
								onCropChange={setCrop}
								onCropComplete={onCropComplete}
								onZoomChange={setZoom}
								showGrid={false}
								cropShape="round"
							/>
						)}
					</div>

					<div className="flex items-center gap-4 py-4">
						<ZoomOut className="w-4 h-4 text-muted-foreground" />
						<Slider
							value={[zoom]}
							min={1}
							max={3}
							step={0.1}
							onValueChange={(value: number[]) => setZoom(value[0])}
							className="flex-1"
						/>
						<ZoomIn className="w-4 h-4 text-muted-foreground" />
					</div>

					<DialogFooter>
						<Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={isUploading}>
							Cancel
						</Button>
						<Button onClick={handleSave} disabled={isUploading}>
							{isUploading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
							Save Picture
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
