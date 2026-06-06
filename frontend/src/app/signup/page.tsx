"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { signUp } from "@/lib/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import Link from "next/link";
import { SiteLogo } from "@/components/site-logo";
import { CheckCircle2, Mail } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { updateUserProfile } from "@/app/lib/rtpGlobalApi";
import {
  PASSWORD_REQUIREMENTS,
  validatePasswordClient,
} from "@/lib/passwordPolicy";

export default function SignupPage() {
    const router = useRouter();
    const { isAuthenticated, authLoading, refreshUser } = useAuth();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [name, setName] = useState("");
    const [organisation, setOrganisation] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);
    const [verificationRequired, setVerificationRequired] = useState(false);
    const [signupEmail, setSignupEmail] = useState("");

    useEffect(() => {
        if (!authLoading && isAuthenticated && !success) {
            router.replace("/assistant");
        }
    }, [authLoading, isAuthenticated, router, success]);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // Validate passwords match
        if (password !== confirmPassword) {
            setError("Passwords do not match");
            setLoading(false);
            return;
        }

        const passwordError = validatePasswordClient(password);
        if (passwordError) {
            setError(passwordError);
            setLoading(false);
            return;
        }

        try {
            const trimmedName = name.trim();
            const trimmedOrg = organisation.trim();
            const result = await signUp({
                email,
                password,
                ...(trimmedName && { displayName: trimmedName }),
                ...(trimmedOrg && { organisation: trimmedOrg }),
            });

            if (result.emailVerificationRequired) {
                setSignupEmail(email);
                setVerificationRequired(true);
                setSuccess(true);
                return;
            }

            await refreshUser();

            if (trimmedName || trimmedOrg) {
                try {
                    await updateUserProfile({
                        ...(trimmedName && { displayName: trimmedName }),
                        ...(trimmedOrg && { organisation: trimmedOrg }),
                    });
                } catch (profileError) {
                    console.error(
                        "[signup] failed to persist profile fields",
                        profileError,
                    );
                }
            }
            setSuccess(true);
            setTimeout(() => {
                router.push("/assistant");
            }, 2000);
        } catch (error: unknown) {
            setError(
                error instanceof Error
                    ? error.message
                    : "An error occurred during signup",
            );
        } finally {
            setLoading(false);
        }
    };

    // Success View
    if (success) {
        return (
            <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
                <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                    <SiteLogo size="md" className="md:text-4xl" asLink />
                </div>
                <div className="w-full max-w-md">
                    <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center shadow-sm">
                        <div className="mx-auto w-12 h-12 bg-green-50 rounded-full flex items-center justify-center mb-6">
                            {verificationRequired ? (
                                <Mail className="h-6 w-6 text-blue-600" />
                            ) : (
                                <CheckCircle2 className="h-6 w-6 text-green-600" />
                            )}
                        </div>
                        <h2 className="text-2xl font-semibold text-gray-900 mb-3">
                            {verificationRequired
                                ? "Check your email"
                                : "Account created!"}
                        </h2>
                        <p className="text-gray-600 leading-relaxed">
                            {verificationRequired ? (
                                <>
                                    We sent a verification link to{" "}
                                    <strong>{signupEmail}</strong>. Verify your
                                    email before signing in.
                                </>
                            ) : (
                                "Redirecting you to the home page..."
                            )}
                        </p>
                        {verificationRequired && (
                            <Link
                                href="/login"
                                className="inline-block mt-6 text-sm text-blue-600 hover:underline"
                            >
                                Go to sign in
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Default Signup Form View
    return (
        <div className="min-h-dvh bg-white flex items-start justify-center px-6 pt-32 md:pt-40 pb-10 relative">
            <div className="absolute top-4 md:top-8 left-1/2 -translate-x-1/2">
                <SiteLogo size="md" className="md:text-4xl" asLink />
            </div>
            <div className="w-full max-w-md">
                <div className="bg-white border border-gray-200 rounded-2xl p-8 mb-4">
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-left text-2xl font-serif">
                            Create Account
                        </h2>
                        <div className="bg-gray-100 p-1 rounded-md flex text-xs font-medium">
                            <Link
                                href="/login"
                                className="px-3 py-1 text-gray-500 hover:text-gray-900"
                            >
                                Log in
                            </Link>
                            <span className="px-3 py-1 bg-white rounded-sm shadow-sm text-gray-900">
                                Sign up
                            </span>
                        </div>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div>
                            <label
                                htmlFor="name"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Name{" "}
                                <span className="text-gray-400 font-normal">
                                    (optional)
                                </span>
                            </label>
                            <Input
                                id="name"
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Your name"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="organisation"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Organisation{" "}
                                <span className="text-gray-400 font-normal">
                                    (optional)
                                </span>
                            </label>
                            <Input
                                id="organisation"
                                type="text"
                                value={organisation}
                                onChange={(e) =>
                                    setOrganisation(e.target.value)
                                }
                                placeholder="Your organisation"
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="email"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Email
                            </label>
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Enter your email"
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="password"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Password
                            </label>
                            <PasswordInput
                                id="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Create a strong password"
                                required
                                className="w-full"
                            />
                        </div>

                        <div>
                            <label
                                htmlFor="confirmPassword"
                                className="block text-sm font-medium text-gray-700 mb-2"
                            >
                                Confirm Password
                            </label>
                            <PasswordInput
                                id="confirmPassword"
                                value={confirmPassword}
                                onChange={(e) =>
                                    setConfirmPassword(e.target.value)
                                }
                                placeholder="Confirm your password"
                                required
                                className="w-full"
                            />
                        </div>

                        {error && (
                            <div className="text-red-600 text-sm bg-red-50 p-3 rounded">
                                {error}
                            </div>
                        )}

                        <p className="text-xs text-gray-500">{PASSWORD_REQUIREMENTS}</p>

                        <Button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-black hover:bg-gray-900 text-white"
                        >
                            {loading ? "Creating account..." : "Sign up"}
                        </Button>
                    </form>

                    {/* Terms and Privacy */}
                    <div className="mt-4 text-center text-xs text-gray-500">
                        By signing up, you agree to our{" "}
                        <Link
                            href="https://rtpglobal.com/terms"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                        >
                            Terms of Use
                        </Link>{" "}
                        and{" "}
                        <Link
                            href="https://rtpglobal.com/privacy"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline"
                        >
                            Privacy Policy
                        </Link>
                    </div>
                </div>
                <p className="text-center text-xs text-gray-500 leading-relaxed px-2">
                    Authentication is required for access to cap-table screening
                    data. Create an account to screen startups under your
                    organisation.
                </p>
            </div>
        </div>
    );
}
