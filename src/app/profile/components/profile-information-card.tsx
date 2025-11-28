'use client';

import { useState, useTransition, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { updateProfile } from '../actions';
import type { UserProfile } from '@/lib/getUserProfile';
import { cn } from '@/lib/utils';

interface ProfileInformationCardProps {
  profile: UserProfile | null;
  userEmail: string;
}

export default function ProfileInformationCard({ profile, userEmail }: ProfileInformationCardProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(profile?.full_name || '');
  const [isPending, startTransition] = useTransition();

  // Sync state when profile changes (e.g., after revalidation)
  useEffect(() => {
    setNameValue(profile?.full_name || '');
  }, [profile?.full_name]);

  const handleNameSave = () => {
    if (!nameValue.trim()) {
      toast.error('Name cannot be empty');
      return;
    }

    const formData = new FormData();
    formData.append('fullName', nameValue);

    startTransition(async () => {
      const result = await updateProfile(formData);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message);
        setIsEditingName(false);
      }
    });
  };

  const handleNameCancel = () => {
    setNameValue(profile?.full_name || '');
    setIsEditingName(false);
  };

  // Generate initials for avatar
  const getInitials = () => {
    if (profile?.full_name) {
      return profile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    if (profile?.guest_name) {
      return profile.guest_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return userEmail?.[0]?.toUpperCase() || '?';
  };

  const displayName = profile?.full_name || profile?.guest_name || 'User';

  // Format date
  const formatDate = (date: string) => {
    if (!date) return 'Unknown';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Information</CardTitle>
        <CardDescription>
          {profile?.is_guest
            ? 'Your guest account information'
            : 'Update your personal details'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-2xl font-semibold flex-shrink-0">
            {getInitials()}
          </div>
          <div>
            <p className="text-sm font-medium">{displayName}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {profile?.is_guest ? 'Guest Account' : userEmail}
            </p>
          </div>
        </div>

        {/* Full Name Field */}
        <div className="space-y-2">
          <Label htmlFor="fullName">
            {profile?.is_guest ? 'Display Name' : 'Full Name'}
          </Label>
          {!isEditingName ? (
            <div className={cn(
              "flex items-center justify-between p-3 rounded-md border bg-card transition-colors group",
              profile?.is_guest
                ? "opacity-60 cursor-not-allowed"
                : "hover:bg-accent/50"
            )}>
              <div>
                <p className="text-sm">{displayName}</p>
              </div>
              {!profile?.is_guest && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => setIsEditingName(true)}
                >
                  Edit
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                id="fullName"
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                placeholder="Enter your full name"
                disabled={isPending || profile?.is_guest}
                className={cn(
                  profile?.is_guest && 'cursor-not-allowed opacity-60'
                )}
                maxLength={255}
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleNameSave}
                  disabled={isPending || !nameValue.trim()}
                >
                  {isPending ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleNameCancel}
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Email Field (Read-only for MVP) */}
        <div className="space-y-2">
          <Label>Email</Label>
          <div className="p-3 rounded-md border bg-muted/50">
            <p className="text-sm">
              {profile?.is_guest ? (
                <span className="text-muted-foreground italic">
                  No email (Guest Account)
                </span>
              ) : (
                userEmail
              )}
            </p>
          </div>
          {!profile?.is_guest && (
            <p className="text-xs text-muted-foreground">
              To change your email, use the Security section below
            </p>
          )}
        </div>

        {/* Member Since */}
        <div className="pt-4 border-t">
          <p className="text-sm text-muted-foreground">
            Member since {formatDate(profile?.created_at)}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
