'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { changePassword, changeEmail } from '../actions';

interface SecurityCardProps {
  userEmail: string;
}

export default function SecurityCard({ userEmail }: SecurityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security</CardTitle>
        <CardDescription>Manage your account security settings</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Password Change Section */}
        <PasswordChangeSection />

        <div className="border-t" />

        {/* Email Change Section */}
        <EmailChangeSection currentEmail={userEmail} />
      </CardContent>
    </Card>
  );
}

function PasswordChangeSection() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = new FormData();
    data.append('currentPassword', formData.currentPassword);
    data.append('newPassword', formData.newPassword);
    data.append('confirmPassword', formData.confirmPassword);

    startTransition(async () => {
      const result = await changePassword(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message);
        setIsOpen(false);
        setFormData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      }
    });
  };

  const handleCancel = () => {
    setFormData({
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    });
    setIsOpen(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium mb-1">Password</h3>
        <p className="text-xs text-muted-foreground mb-4">
          Change your password to keep your account secure
        </p>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Change Password</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Change Password</DialogTitle>
                <DialogDescription>
                  Enter your current password and choose a new one
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    required
                    value={formData.currentPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, currentPassword: e.target.value })
                    }
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    required
                    minLength={8}
                    value={formData.newPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, newPassword: e.target.value })
                    }
                    disabled={isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum 8 characters
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    required
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    disabled={isPending}
                  />
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Updating...' : 'Update Password'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function EmailChangeSection({ currentEmail }: { currentEmail: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [formData, setFormData] = useState({
    newEmail: '',
    currentPassword: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data = new FormData();
    data.append('newEmail', formData.newEmail);
    data.append('currentPassword', formData.currentPassword);

    startTransition(async () => {
      const result = await changeEmail(data);

      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(result.message);
        setIsOpen(false);
        setFormData({
          newEmail: '',
          currentPassword: '',
        });
      }
    });
  };

  const handleCancel = () => {
    setFormData({
      newEmail: '',
      currentPassword: '',
    });
    setIsOpen(false);
  };

  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-sm font-medium mb-1">Email Address</h3>
        <p className="text-xs text-muted-foreground mb-2">
          Current email: <span className="font-medium text-foreground">{currentEmail}</span>
        </p>
        <p className="text-xs text-muted-foreground mb-4">
          Update your email address. You'll need to verify the new address.
        </p>
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">Change Email</Button>
          </DialogTrigger>
          <DialogContent>
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Change Email Address</DialogTitle>
                <DialogDescription>
                  Enter your new email address and current password for verification
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="newEmail">New Email Address</Label>
                  <Input
                    id="newEmail"
                    type="email"
                    required
                    placeholder="new.email@example.com"
                    value={formData.newEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, newEmail: e.target.value })
                    }
                    disabled={isPending}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailPassword">Current Password</Label>
                  <Input
                    id="emailPassword"
                    type="password"
                    required
                    value={formData.currentPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, currentPassword: e.target.value })
                    }
                    disabled={isPending}
                  />
                  <p className="text-xs text-muted-foreground">
                    We need your password to verify this change
                  </p>
                </div>

                <div className="rounded-md bg-info-muted p-3 border border-info/30">
                  <p className="text-xs text-info-foreground">
                    After submitting, you'll receive a verification email at your new address.
                    Click the link in that email to complete the change.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCancel}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? 'Sending...' : 'Send Verification Email'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
