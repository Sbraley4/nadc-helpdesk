import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../../api';
import Modal from './Modal';
import Input from './Input';
import Button from './Button';

const passwordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function ChangePasswordModal({ isOpen, onClose }) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  const newPassword = watch('newPassword');

  // Password strength indicators
  const hasMinLength = newPassword?.length >= 8;
  const hasUppercase = /[A-Z]/.test(newPassword || '');
  const hasLowercase = /[a-z]/.test(newPassword || '');
  const hasNumber = /[0-9]/.test(newPassword || '');

  const handleClose = () => {
    reset();
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    onClose();
  };

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await auth.changePassword(data.currentPassword, data.newPassword);
      toast.success('Password changed successfully');
      handleClose();
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to change password';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Change Password">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Current Password"
          type={showCurrentPassword ? 'text' : 'password'}
          autoComplete="current-password"
          leftIcon={<Lock size={18} />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowCurrentPassword(!showCurrentPassword)}
              className="focus:outline-none"
            >
              {showCurrentPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
          error={errors.currentPassword?.message}
          {...register('currentPassword')}
        />

        <div>
          <Input
            label="New Password"
            type={showNewPassword ? 'text' : 'password'}
            autoComplete="new-password"
            leftIcon={<Lock size={18} />}
            rightIcon={
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="focus:outline-none"
              >
                {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            }
            error={errors.newPassword?.message}
            {...register('newPassword')}
          />

          {/* Password strength indicators */}
          {newPassword && (
            <div className="mt-2 space-y-1 text-sm">
              <div className={`flex items-center gap-2 ${hasMinLength ? 'text-green-600' : 'text-gray-400'}`}>
                {hasMinLength ? <CheckCircle size={14} /> : <XCircle size={14} />}
                At least 8 characters
              </div>
              <div className={`flex items-center gap-2 ${hasUppercase ? 'text-green-600' : 'text-gray-400'}`}>
                {hasUppercase ? <CheckCircle size={14} /> : <XCircle size={14} />}
                One uppercase letter
              </div>
              <div className={`flex items-center gap-2 ${hasLowercase ? 'text-green-600' : 'text-gray-400'}`}>
                {hasLowercase ? <CheckCircle size={14} /> : <XCircle size={14} />}
                One lowercase letter
              </div>
              <div className={`flex items-center gap-2 ${hasNumber ? 'text-green-600' : 'text-gray-400'}`}>
                {hasNumber ? <CheckCircle size={14} /> : <XCircle size={14} />}
                One number
              </div>
            </div>
          )}
        </div>

        <Input
          label="Confirm New Password"
          type={showConfirmPassword ? 'text' : 'password'}
          autoComplete="new-password"
          leftIcon={<Lock size={18} />}
          rightIcon={
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="focus:outline-none"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          }
          error={errors.confirmPassword?.message}
          {...register('confirmPassword')}
        />

        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={handleClose} className="w-full sm:w-auto">
            Cancel
          </Button>
          <Button type="submit" isLoading={isSubmitting} className="w-full sm:w-auto">
            Change Password
          </Button>
        </div>
      </form>
    </Modal>
  );
}
