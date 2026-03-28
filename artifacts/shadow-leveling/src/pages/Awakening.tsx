import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { 
  useGetAwakening,
  useSaveAwakening,
  getGetAwakeningQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { BookOpen, Eye, Skull, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useEffect } from "react";
const awakeningImg = "/images/awakening.png";

const schema = z.object({
  vision: z.string().optional(),
  antiVision: z.string().optional(),
  coreValues: z.string().optional(),
});

export default function Awakening() {
  const { data: awakening, isLoading } = useGetAwakening();
  const saveAwakening = useSaveAwakening();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    defaultValues: {
      vision: "",
      antiVision: "",
      coreValues: "",
    }
  });

  useEffect(() => {
    if (awakening) {
      form.reset({
        vision: awakening.vision || "",
        antiVision: awakening.antiVision || "",
        coreValues: awakening.coreValues || "",
      });
    }
  }, [awakening, form]);

  const onSubmit = (data: z.infer<typeof schema>) => {
    saveAwakening.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetAwakeningQueryKey() });
        toast({ 
          title: "Visions Recorded", 
          description: "Your awakening has been solidified in the system.",
          className: "bg-primary/20 border-primary text-primary shadow-[0_0_20px_rgba(124,58,237,0.3)]"
        });
      }
    });
  };

  if (isLoading) return <div className="p-8">Accessing memory core...</div>;

  return (
    <div className="min-h-screen relative pb-12">
      <div 
        className="absolute inset-0 z-0 opacity-10 pointer-events-none mix-blend-screen"
        style={{ backgroundImage: `url(${awakeningImg})`, backgroundSize: 'cover', backgroundPosition: 'center top' }}
      />

      <div className="relative z-10 p-6 md:p-8 max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-4 mb-12">
          <BookOpen className="w-12 h-12 text-primary mx-auto opacity-80" />
          <h1 className="text-5xl md:text-6xl font-display font-black text-white tracking-widest drop-shadow-[0_0_15px_rgba(124,58,237,0.5)]">
            THE AWAKENING
          </h1>
          <p className="text-muted-foreground text-lg tracking-widest uppercase max-w-2xl mx-auto">
            Define your true purpose. The system only responds to absolute conviction.
          </p>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <FormField control={form.control} name="vision" render={({ field }) => (
                <FormItem className="glass-panel p-6 rounded-2xl border-primary/20 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-primary/50" />
                  <FormLabel className="text-xl font-display tracking-widest text-primary flex items-center gap-2 mb-4">
                    <Eye className="w-5 h-5" /> THE VISION (Ideal Future)
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Who are you becoming if you succeed?"
                      className="min-h-[250px] bg-background/50 border-white/5 focus-visible:ring-primary text-base leading-relaxed"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="antiVision" render={({ field }) => (
                <FormItem className="glass-panel p-6 rounded-2xl border-destructive/20 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-destructive/50" />
                  <FormLabel className="text-xl font-display tracking-widest text-destructive flex items-center gap-2 mb-4">
                    <Skull className="w-5 h-5" /> THE ANTI-VISION (Worst Case)
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Who do you become if you surrender to weakness?"
                      className="min-h-[250px] bg-background/50 border-white/5 focus-visible:ring-destructive text-base leading-relaxed"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="coreValues" render={({ field }) => (
              <FormItem className="glass-panel p-6 rounded-2xl border-white/10 max-w-3xl mx-auto relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-white/20" />
                <FormLabel className="text-xl font-display tracking-widest text-white flex items-center gap-2 mb-4">
                  <Sparkles className="w-5 h-5 text-yellow-400" /> CORE LAWS
                </FormLabel>
                <FormControl>
                  <Textarea 
                    {...field} 
                    placeholder="Non-negotiable rules for your life..."
                    className="min-h-[150px] bg-background/50 border-white/5 text-base leading-relaxed"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-center pt-8">
              <Button 
                type="submit" 
                size="lg"
                className="h-14 px-12 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-display font-bold tracking-widest hover-glow"
                disabled={saveAwakening.isPending}
              >
                {saveAwakening.isPending ? "SYNCHRONIZING..." : "IMPRINT TO SYSTEM"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
