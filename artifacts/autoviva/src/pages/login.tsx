import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { AuthLayout } from "@/components/layout/auth-layout";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useLogin } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address." }),
  password: z.string().min(1, { message: "Password is required." }),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const loginMutation = useLogin();

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginFormValues) => {
    loginMutation.mutate(
      { data },
      {
        onSuccess: (res) => {
          login(res.token, res.user);
          toast({
            title: "Welcome back",
            description: "Successfully authenticated with AutoViva.",
          });
          setLocation("/dashboard");
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Authentication failed",
            description: error?.data?.error || "Invalid credentials.",
          });
        },
      }
    );
  };

  return (
    <AuthLayout 
      title="Welcome Back" 
      subtitle="Sign in to your account to continue evaluating projects."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">Email</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="name@college.edu" 
                    type="email" 
                    {...field} 
                    disabled={loginMutation.isPending} 
                    className="bg-[#0a0a0c] border border-white/14 rounded-md focus-visible:ring-0 focus-visible:border-[#fcfdff] text-[#fcfdff] placeholder-neutral-600 h-10 transition-colors"
                  />
                </FormControl>
                <FormMessage className="text-[#ff2047] text-xs font-sans mt-1" />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between">
                  <FormLabel className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">Password</FormLabel>
                  <Link href="/forgot-password" className="text-xs font-sans text-[#3b9eff] hover:underline transition-all">
                    Forgot password?
                  </Link>
                </div>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    {...field} 
                    disabled={loginMutation.isPending} 
                    className="bg-[#0a0a0c] border border-white/14 rounded-md focus-visible:ring-0 focus-visible:border-[#fcfdff] text-[#fcfdff] placeholder-neutral-600 h-10 transition-colors"
                  />
                </FormControl>
                <FormMessage className="text-[#ff2047] text-xs font-sans mt-1" />
              </FormItem>
            )}
          />
          <Button 
            type="submit" 
            className="w-full bg-[#fcfdff] text-black hover:bg-[#f1f7fe] font-sans font-medium rounded-md h-10 shadow-none mt-2 transition-all" 
            disabled={loginMutation.isPending}
          >
            {loginMutation.isPending ? "Verifying credentials..." : "Sign In"}
          </Button>
        </form>
      </Form>
      
      <div className="mt-8 text-center text-xs text-[#888e90] font-sans">
        Don't have an account?{" "}
        <Link href="/register" className="text-[#3b9eff] hover:underline font-medium ml-1">
          Create an account
        </Link>
      </div>
    </AuthLayout>
  );
}
