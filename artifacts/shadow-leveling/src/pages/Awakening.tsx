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
import { InfoTooltip } from "@/components/InfoTooltip";
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
          <InfoTooltip
            what="The Awakening — your core motivational framework."
            fn="A place to define your ideal future, your worst-case anti-vision, and the non-negotiable rules governing your life."
            usage="Fill in each section honestly. These texts are shown to you as a reminder of why you are doing the work. Imprint them to save."
          >
            <h1 className="text-5xl md:text-6xl font-display font-black text-white tracking-widest drop-shadow-[0_0_15px_rgba(124,58,237,0.5)]">
              THE AWAKENING
            </h1>
          </InfoTooltip>
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
                  <InfoTooltip
                    what="The Vision — your ideal future self."
                    fn="A vivid description of who you become if you consistently follow through. Serves as your north star motivation."
                    usage="Write in the present tense as if you've already achieved it. Be specific about what your life looks and feels like."
                  >
                    <FormLabel className="text-xl font-display tracking-widest text-primary flex items-center gap-2 mb-4">
                      <Eye className="w-5 h-5" /> THE VISION (Ideal Future)
                    </FormLabel>
                  </InfoTooltip>
                  <InfoTooltip
                    what="Vision textarea — describe your ideal future in your own words."
                    fn="This text is saved when you press 'Imprint to System'. It is loaded each time you open the Awakening page."
                    usage="Write freely and specifically. Revisit and update this as your vision evolves. The more vivid the description, the stronger the motivational anchor."
                  >
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Who are you becoming if you succeed?"
                        className="min-h-[250px] bg-background/50 border-white/5 focus-visible:ring-primary text-base leading-relaxed"
                      />
                    </FormControl>
                  </InfoTooltip>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="antiVision" render={({ field }) => (
                <FormItem className="glass-panel p-6 rounded-2xl border-destructive/20 relative overflow-hidden group">
                  <div className="absolute top-0 left-0 w-1 h-full bg-destructive/50" />
                  <InfoTooltip
                    what="The Anti-Vision — your worst-case future self."
                    fn="A stark description of who you become if you give in to laziness and bad habits. Acts as a fear-based motivator."
                    usage="Be brutally honest. Describe the concrete consequences of failure — relationships, health, finances. Revisit this when motivation wanes."
                  >
                    <FormLabel className="text-xl font-display tracking-widest text-destructive flex items-center gap-2 mb-4">
                      <Skull className="w-5 h-5" /> THE ANTI-VISION (Worst Case)
                    </FormLabel>
                  </InfoTooltip>
                  <InfoTooltip
                    what="Anti-Vision textarea — describe your worst-case failure scenario."
                    fn="This text is saved when you press 'Imprint to System'. It is loaded each time you open the Awakening page."
                    usage="Be brutally specific. Name the people who would be disappointed, the opportunities lost, the health and financial damage. Make it visceral enough to repel complacency."
                  >
                    <FormControl>
                      <Textarea 
                        {...field} 
                        placeholder="Who do you become if you surrender to weakness?"
                        className="min-h-[250px] bg-background/50 border-white/5 focus-visible:ring-destructive text-base leading-relaxed"
                      />
                    </FormControl>
                  </InfoTooltip>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="coreValues" render={({ field }) => (
              <FormItem className="glass-panel p-6 rounded-2xl border-white/10 max-w-3xl mx-auto relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-white/20" />
                <InfoTooltip
                  what="Core Laws — your non-negotiable personal rules."
                  fn="A set of principles and commitments that define your character. These are the rules you refuse to break regardless of circumstances."
                  usage="List rules like 'Never skip workouts two days in a row' or 'No social media before noon.' These act as guardrails against self-sabotage."
                >
                  <FormLabel className="text-xl font-display tracking-widest text-white flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-cyan-400" /> CORE LAWS
                  </FormLabel>
                </InfoTooltip>
                <InfoTooltip
                  what="Core Laws textarea — list your non-negotiable personal rules."
                  fn="This text is saved when you press 'Imprint to System'. It is loaded each time you open the Awakening page."
                  usage="Write each rule on its own line. Keep them action-oriented and specific, e.g. 'No alcohol on weekdays' or 'Sleep by 11 PM every night.' Review and tighten these laws monthly."
                >
                  <FormControl>
                    <Textarea 
                      {...field} 
                      placeholder="Non-negotiable rules for your life..."
                      className="min-h-[150px] bg-background/50 border-white/5 text-base leading-relaxed"
                    />
                  </FormControl>
                </InfoTooltip>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-center pt-8">
              <InfoTooltip
                what="Imprint to System — save your Awakening entries."
                fn="Persists your Vision, Anti-Vision, and Core Laws to the database so they are available across sessions."
                usage="Click after completing or updating any of the three fields. Your entries are only saved when you press this button."
              >
                <Button 
                  type="submit" 
                  size="lg"
                  className="h-14 px-12 text-lg bg-primary hover:bg-primary/90 text-primary-foreground font-display font-bold tracking-widest hover-glow"
                  disabled={saveAwakening.isPending}
                >
                  {saveAwakening.isPending ? "SYNCHRONIZING..." : "IMPRINT TO SYSTEM"}
                </Button>
              </InfoTooltip>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}
