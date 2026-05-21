import { SidebarLayout } from "@/components/layout/sidebar-layout";
import { useParams, useLocation } from "wouter";
import { useGetProject, getGetProjectQueryKey, useUpdateProject, useListCredentials, getListCredentialsQueryKey, useCreateCredential, useDeleteCredential } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Plus, Trash2, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const projectSchema = z.object({
  name: z.string().min(2),
  baseUrl: z.string().url("Must be a valid URL"),
  description: z.string().optional(),
  techStack: z.string().optional(),
  loginUrl: z.string().optional(),
});

type ProjectFormValues = z.infer<typeof projectSchema>;

const credSchema = z.object({
  role: z.string().min(1),
  username: z.string().min(1),
  password: z.string().min(1),
});
type CredFormValues = z.infer<typeof credSchema>;

export default function ProjectEdit() {
  const params = useParams();
  const [, setLocation] = useLocation();
  const projectId = params.projectId || "";
  const queryClient = useQueryClient();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showAddCred, setShowAddCred] = useState(false);

  const { data: project, isLoading } = useGetProject(projectId, {
    query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) }
  });
  const { data: credentials } = useListCredentials(projectId, {
    query: { enabled: !!projectId, queryKey: getListCredentialsQueryKey(projectId) }
  });

  const updateProject = useUpdateProject();
  const createCredential = useCreateCredential();
  const deleteCredential = useDeleteCredential();

  const form = useForm<ProjectFormValues>({
    resolver: zodResolver(projectSchema),
    defaultValues: { name: "", baseUrl: "", description: "", techStack: "", loginUrl: "" },
  });

  const credForm = useForm<CredFormValues>({
    resolver: zodResolver(credSchema),
    defaultValues: { role: "admin", username: "", password: "" },
  });

  useEffect(() => {
    if (project) {
      form.reset({
        name: project.name,
        baseUrl: project.baseUrl,
        description: project.description ?? "",
        techStack: project.techStack ?? "",
        loginUrl: project.loginUrl ?? "",
      });
    }
  }, [project]);

  const onSubmit = (data: ProjectFormValues) => {
    setSaveError(null);
    updateProject.mutate(
      { projectId, data },
      {
        onSuccess: () => {
          setSaveSuccess(true);
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          setTimeout(() => setLocation(`/projects/${projectId}`), 1200);
        },
        onError: (err: any) => setSaveError(err?.data?.error ?? "Failed to save")
      }
    );
  };

  const onAddCred = (data: CredFormValues) => {
    createCredential.mutate(
      { projectId, data },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListCredentialsQueryKey(projectId) });
          credForm.reset({ role: "admin", username: "", password: "" });
          setShowAddCred(false);
        }
      }
    );
  };

  const handleDeleteCred = (credentialId: string) => {
    deleteCredential.mutate({ projectId, credentialId }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListCredentialsQueryKey(projectId) })
    });
  };

  if (isLoading) {
    return (
      <SidebarLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      </SidebarLayout>
    );
  }

  return (
    <SidebarLayout>
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Edit Project</h1>
            <p className="text-muted-foreground text-sm mt-1">{project?.name}</p>
          </div>
          <Button variant="ghost" onClick={() => setLocation(`/projects/${projectId}`)}>Cancel</Button>
        </div>

        {/* Project Details */}
        <Card>
          <CardHeader><CardTitle>Project Details</CardTitle></CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField control={form.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project Name</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="baseUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base URL</FormLabel>
                    <FormControl><Input placeholder="http://localhost:3000" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea className="min-h-[80px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="techStack" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tech Stack</FormLabel>
                    <FormControl><Input placeholder="React, Node.js, Postgres" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="loginUrl" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Login URL</FormLabel>
                    <FormControl><Input placeholder="http://localhost:3000/login" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                {saveError && (
                  <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                    <AlertCircle className="w-4 h-4 shrink-0" />{saveError}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button type="submit" disabled={updateProject.isPending || saveSuccess} className="gap-2">
                    {saveSuccess ? <><CheckCircle2 className="w-4 h-4 text-green-400" />Saved!</> :
                     updateProject.isPending ? <><Loader2 className="w-4 h-4 animate-spin" />Saving...</> :
                     "Save Changes"}
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Credentials */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Test Credentials</CardTitle>
            <Button variant="outline" size="sm" className="gap-1" onClick={() => setShowAddCred(!showAddCred)}>
              <Plus className="w-3.5 h-3.5" /> Add
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {credentials?.map(c => (
              <div key={c.id} className="flex items-center justify-between p-3 bg-muted/30 border border-border rounded-lg">
                <div className="flex items-center gap-3">
                  <ShieldCheck className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium capitalize">{c.role}</p>
                    <p className="text-xs text-muted-foreground">{c.username}</p>
                  </div>
                </div>
                <Button
                  variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400"
                  onClick={() => handleDeleteCred(c.id)}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}

            {showAddCred && (
              <Form {...credForm}>
                <form onSubmit={credForm.handleSubmit(onAddCred)} className="space-y-3 p-4 bg-card border border-primary/30 rounded-lg mt-2">
                  <p className="text-sm font-medium">Add Credential</p>
                  <div className="grid grid-cols-3 gap-2">
                    <FormField control={credForm.control} name="role" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Role</FormLabel>
                        <FormControl>
                          <select className="w-full h-8 text-xs bg-background border border-input rounded px-2" {...field}>
                            <option value="admin">Admin</option>
                            <option value="user">User</option>
                            <option value="student">Student</option>
                            <option value="teacher">Teacher</option>
                          </select>
                        </FormControl>
                      </FormItem>
                    )} />
                    <FormField control={credForm.control} name="username" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Username</FormLabel>
                        <FormControl><Input className="h-8 text-xs" placeholder="admin@test.com" {...field} /></FormControl>
                      </FormItem>
                    )} />
                    <FormField control={credForm.control} name="password" render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs">Password</FormLabel>
                        <FormControl><Input className="h-8 text-xs" type="password" placeholder="••••••••" {...field} /></FormControl>
                      </FormItem>
                    )} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="ghost" size="sm" onClick={() => setShowAddCred(false)}>Cancel</Button>
                    <Button type="submit" size="sm" disabled={createCredential.isPending}>
                      {createCredential.isPending ? "Adding..." : "Add"}
                    </Button>
                  </div>
                </form>
              </Form>
            )}
          </CardContent>
        </Card>
      </div>
    </SidebarLayout>
  );
}
