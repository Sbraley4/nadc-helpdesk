import { useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, Lock, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import { auth } from '../../api';
import { Button, Input } from '../../components/shared';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordSubmitted, setForgotPasswordSubmitted] = useState(false);

  // DEBUG: Log every render
  console.log('[LoginPage] RENDER - authLoading:', authLoading, 'isAuthenticated:', isAuthenticated);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: '',
      password: '',
      rememberMe: false,
    },
  });

  const {
    register: registerForgot,
    handleSubmit: handleForgotSubmit,
    formState: { errors: forgotErrors },
    reset: resetForgot,
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: '',
    },
  });

  // Show loading while checking existing auth token
  if (authLoading) {
    console.log('[LoginPage] RETURNING: Loading spinner (authLoading=true)');
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Redirect if already authenticated
  if (isAuthenticated) {
    console.log('[LoginPage] RETURNING: Navigate to /tickets (isAuthenticated=true)');
    return <Navigate to="/tickets" replace />;
  }

  console.log('[LoginPage] RETURNING: Login form');

  const onSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await login(data.email, data.password, data.rememberMe);
      toast.success('Welcome back!');
      navigate('/tickets', { replace: true });
    } catch (error) {
      const message = error.response?.data?.message || 'Invalid email or password';
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onForgotSubmit = async (data) => {
    setIsSubmitting(true);
    try {
      await auth.forgotPassword(data.email);
      setForgotPasswordSubmitted(true);
    } catch (error) {
      // Still show success to prevent email enumeration
      setForgotPasswordSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleBackToLogin = () => {
    setShowForgotPassword(false);
    setForgotPasswordSubmitted(false);
    resetForgot();
  };

  // Forgot password success state
  if (showForgotPassword && forgotPasswordSubmitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <img src="/nadclogo.png" alt="NADC" className="mx-auto h-28 w-auto" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Check Your Email
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              If an account exists with that email address, we've sent instructions to reset your password.
            </p>
          </div>

          <div className="mt-8">
            <Button
              type="button"
              variant="secondary"
              className="w-full"
              size="lg"
              onClick={handleBackToLogin}
              leftIcon={<ArrowLeft size={18} />}
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Forgot password form
  if (showForgotPassword) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-md w-full space-y-8">
          <div className="text-center">
            <img src="/nadclogo.png" alt="NADC" className="mx-auto h-28 w-auto" />
            <h2 className="mt-6 text-3xl font-bold text-gray-900">
              Reset Password
            </h2>
            <p className="mt-2 text-sm text-gray-600">
              Enter your email address and we'll send you a link to reset your password.
            </p>
          </div>

          <form className="mt-8 space-y-6" onSubmit={handleForgotSubmit(onForgotSubmit)}>
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              leftIcon={<Mail size={18} />}
              error={forgotErrors.email?.message}
              {...registerForgot('email')}
            />

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isSubmitting}
            >
              Send Reset Link
            </Button>

            <Button
              type="button"
              variant="secondary"
              className="w-full"
              size="lg"
              onClick={handleBackToLogin}
              leftIcon={<ArrowLeft size={18} />}
            >
              Back to Sign In
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Logo and title */}
        <div className="text-center">
<img src="/nadclogo.png" alt="NADC" className="mx-auto h-28 w-auto" />
          <h2 className="mt-6 text-3xl font-bold text-gray-900">
            NADC Helpdesk
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Sign in to your account
          </p>
        </div>

        {/* Login form */}
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <Input
              label="Email address"
              type="email"
              autoComplete="email"
              leftIcon={<Mail size={18} />}
              error={errors.email?.message}
              {...register('email')}
            />

            <div>
              <Input
                label="Password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
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
              <div className="mt-2 flex items-center justify-between">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="h-4 w-4 text-primary border-gray-300 rounded focus:ring-primary"
                    {...register('rememberMe')}
                  />
                  <span className="ml-2 text-sm text-gray-600">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(true)}
                  className="text-sm text-primary hover:text-primary-dark font-medium"
                >
                  Forgot Password?
                </button>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full"
            size="lg"
            isLoading={isSubmitting}
          >
            Sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
