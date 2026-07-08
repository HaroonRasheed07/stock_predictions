import { Github, Linkedin, Mail } from 'lucide-react';

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12 md:py-24 max-w-4xl">
      <div className="space-y-8 text-center">
        <h1 className="text-4xl font-bold tracking-tight">Contact Me</h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Feel free to reach out to me via email or connect with me on social media.
        </p>
        
        <div className="grid gap-8 md:grid-cols-3 mt-12">
          <a
            href="mailto:haroonchoudhary2322@gmail.com"
            className="flex flex-col items-center justify-center p-8 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-primary/5 hover:border-primary/50 transition-all group"
          >
            <div className="p-4 rounded-full bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
              <Mail className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">Email</h3>
            <p className="text-sm text-muted-foreground text-center">
              haroonchoudhary2322@gmail.com
            </p>
          </a>

          <a
            href="https://www.linkedin.com/in/haroon-rasheed-55022427a"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-8 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-primary/5 hover:border-primary/50 transition-all group"
          >
            <div className="p-4 rounded-full bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
              <Linkedin className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">LinkedIn</h3>
            <p className="text-sm text-muted-foreground text-center">
              Haroon Rasheed
            </p>
          </a>

          <a
            href="https://github.com/HaroonRasheed07"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center justify-center p-8 rounded-xl border border-border/40 bg-card/30 backdrop-blur-sm hover:bg-primary/5 hover:border-primary/50 transition-all group"
          >
            <div className="p-4 rounded-full bg-primary/10 text-primary mb-4 group-hover:scale-110 transition-transform">
              <Github className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">GitHub</h3>
            <p className="text-sm text-muted-foreground text-center">
              @HaroonRasheed07
            </p>
          </a>
        </div>
      </div>
    </div>
  );
}
