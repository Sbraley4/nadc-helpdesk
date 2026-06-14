import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Lock, Eye, EyeOff, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { auth } from '../../api';
import { Button, Input } from '../../components/shared';

const passwordSchema = z.object({
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Please confirm your password'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

export default function ResetPasswordPage() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isValid, setIsValid] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const password = watch('password');

  // Password strength indicators
  const hasMinLength = password.length >= 8;
  const hasUppercase = /[A-Z]/.test(password);
  const hasLowercase = /[a-z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  useEffect(() => {
    async function verifyToken() {
      try {
        const response = await auth.verifyResetToken(token);
        if (response.valid) {
          setIsValid(true);
          setUserEmail(response.email);
        }
      } catch (error) {
        setIsValid(false);
      } finally {
        setIsVerifying(false);
      }
    }

    if (token) {
      verifyToken();
    } else {
      setIsVerifying(false);
      setIsValid(false);
    }
  }, [token]);

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await auth.resetPassword(token, data.password);
      setSuccess(true);
      toast.success('Password reset successfully!');
    } catch (error) {
      const message = error.response?.data?.error || 'Failed to reset password';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="mt-4 text-gray-600">Verifying your reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid token
  if (!isValid) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto h-16 w-16 bg-red-100 rounded-full flex items-center justify-center">
            <XCircle className="h-10 w-10 text-red-500" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Invalid or Expired Link
          </h2>
          <p className="mt-2 text-gray-600">
            This password reset link is invalid or has expired.
            Please request a new reset link.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block text-primary hover:text-primary-dark font-medium"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
        <div className="max-w-md w-full text-center">
          <div className="mx-auto h-16 w-16 bg-green-100 rounded-full flex items-center justify-center">
            <CheckCircle className="h-10 w-10 text-green-500" />
          </div>
          <h2 className="mt-6 text-2xl font-bold text-gray-900">
            Password Reset Successfully!
          </h2>
          <p className="mt-2 text-gray-600">
            Your password has been reset. You can now log in with your new password.
          </p>
          <Button
            onClick={() => navigate('/login')}
            className="mt-6"
          >
            Go to Login
          </Button>
        </div>
      </div>
    );
  }

  // Reset form
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and title */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-primary rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-2xl">N</span>
          </div>
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            Reset Your Password
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Create a new password for your account.
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {userEmail}
          </p>
        </div>

        {/* Password form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <Input
                label="New Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                leftIcon={<Lock size={18} />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="focus:outline-none"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                }
                error={errors.password?.message}
                {...register('password')}
              />
            </div>

            {/* Password strength indicators */}
            {password && (
              <div className="space-y-1 text-sm">
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

            <div>
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
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
          >
            Reset Password
          </Button>
        </form>
      </div>
    </div>
  );
}
