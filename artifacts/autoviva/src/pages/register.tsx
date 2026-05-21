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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRegister } from "@workspace/api-client-react";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";

const registerSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
  college: z.string().optional(),
  role: z.enum(["student", "faculty", "judge"], {
    required_error: "Please select a role.",
  }),
  password: z.string().min(8, { message: "Password must be at least 8 characters." }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function Register() {
  const [, setLocation] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();
  const registerMutation = useRegister();

  const form = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      college: "",
      role: "student",
      password: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (data: RegisterFormValues) => {
    const { confirmPassword, ...apiData } = data;
    
    registerMutation.mutate(
      { data: apiData },
      {
        onSuccess: (res) => {
          login(res.token, res.user);
          toast({
            title: "Account created",
            description: "Successfully registered on AutoViva.",
          });
          setLocation("/dashboard");
        },
        onError: (error: any) => {
          toast({
            variant: "destructive",
            title: "Registration failed",
            description: error?.data?.error || "Could not register details.",
          });
        },
      }
    );
  };

  return (
    <AuthLayout 
      title="Create an Account" 
      subtitle="Join AutoViva AI to start evaluating your projects."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">Full Name</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="John Doe" 
                    {...field} 
                    disabled={registerMutation.isPending} 
                    className="bg-[#0a0a0c] border border-white/14 rounded-md focus-visible:ring-0 focus-visible:border-[#fcfdff] text-[#fcfdff] placeholder-neutral-600 h-10 transition-colors"
                  />
                </FormControl>
                <FormMessage className="text-[#ff2047] text-xs font-sans mt-1" />
              </FormItem>
            )}
          />
          
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
                    disabled={registerMutation.isPending} 
                    className="bg-[#0a0a0c] border border-white/14 rounded-md focus-visible:ring-0 focus-visible:border-[#fcfdff] text-[#fcfdff] placeholder-neutral-600 h-10 transition-colors"
                  />
                </FormControl>
                <FormMessage className="text-[#ff2047] text-xs font-sans mt-1" />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="college"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">College / University</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="MIT" 
                      {...field} 
                      disabled={registerMutation.isPending} 
                      className="bg-[#0a0a0c] border border-white/14 rounded-md focus-visible:ring-0 focus-visible:border-[#fcfdff] text-[#fcfdff] placeholder-neutral-600 h-10 transition-colors"
                    />
                  </FormControl>
                  <FormMessage className="text-[#ff2047] text-xs font-sans mt-1" />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">Role</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value} disabled={registerMutation.isPending}>
                    <FormControl>
                      <SelectTrigger className="bg-[#0a0a0c] border border-white/14 rounded-md text-[#fcfdff] focus:ring-0 focus:border-[#fcfdff] h-10 transition-colors">
                        <SelectValue placeholder="Select a role" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent className="bg-[#0a0a0c] border border-white/14 text-[#fcfdff]">
                      <SelectItem value="student" className="hover:bg-white/4 focus:bg-white/4">Student</SelectItem>
                      <SelectItem value="faculty" className="hover:bg-white/4 focus:bg-white/4">Faculty</SelectItem>
                      <SelectItem value="judge" className="hover:bg-white/4 focus:bg-white/4">Judge</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage className="text-[#ff2047] text-xs font-sans mt-1" />
                </FormItem>
              )}
            />
          </div>
          
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">Password</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    {...field} 
                    disabled={registerMutation.isPending} 
                    className="bg-[#0a0a0c] border border-white/14 rounded-md focus-visible:ring-0 focus-visible:border-[#fcfdff] text-[#fcfdff] placeholder-neutral-600 h-10 transition-colors"
                  />
                </FormControl>
                <FormMessage className="text-[#ff2047] text-xs font-sans mt-1" />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs uppercase tracking-wider text-[#a1a4a5] font-sans font-medium">Confirm Password</FormLabel>
                <FormControl>
                  <Input 
                    type="password" 
                    placeholder="••••••••" 
                    {...field} 
                    disabled={registerMutation.isPending} 
                    className="bg-[#0a0a0c] border border-white/14 rounded-md focus-visible:ring-0 focus-visible:border-[#fcfdff] text-[#fcfdff] placeholder-neutral-600 h-10 transition-colors"
                  />
                </FormControl>
                <FormMessage className="text-[#ff2047] text-xs font-sans mt-1" />
              </FormItem>
            )}
          />
          
          <Button 
            type="submit" 
            className="w-full bg-[#fcfdff] text-black hover:bg-[#f1f7fe] font-sans font-medium rounded-md h-10 shadow-none mt-6 transition-all" 
            disabled={registerMutation.isPending}
          >
            {registerMutation.isPending ? "Creating account..." : "Create Account"}
          </Button>
        </form>
      </Form>
      
      <div className="mt-6 text-center text-xs text-[#888e90] font-sans">
        Already have an account?{" "}
        <Link href="/login" className="text-[#3b9eff] hover:underline font-medium ml-1">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
}
