import { Mail, Github, Linkedin } from "lucide-react";

export default function ContactPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-4xl pt-24 min-h-screen">
      <h1 className="text-4xl font-bold mb-8 text-center bg-clip-text text-transparent bg-gradient-primary">
        Contact Me
      </h1>
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-xl p-8 shadow-sm">
        <p className="text-lg text-muted-foreground mb-8 text-center">
          Feel free to reach out through any of the following platforms.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <a
            href="mailto:haroonchoudhary2322@gmail.com"
            className="flex flex-col items-center p-6 rounded-lg bg-muted/50 hover:bg-primary/10 hover:border-primary/50 border border-transparent transition-all group"
          >
            <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform mb-4">
              <Mail className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">Email</h3>
            <span className="text-sm text-muted-foreground text-center break-all">
              haroonchoudhary2322@gmail.com
            </span>
          </a>

          <a
            href="https://www.linkedin.com/in/haroon-rasheed-55022427a"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center p-6 rounded-lg bg-muted/50 hover:bg-primary/10 hover:border-primary/50 border border-transparent transition-all group"
          >
            <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform mb-4">
              <Linkedin className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">LinkedIn</h3>
            <span className="text-sm text-muted-foreground text-center">
              Connect with me
            </span>
          </a>

          <a
            href="https://github.com/HaroonRasheed07"
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-col items-center p-6 rounded-lg bg-muted/50 hover:bg-primary/10 hover:border-primary/50 border border-transparent transition-all group"
          >
            <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:scale-110 transition-transform mb-4">
              <Github className="h-8 w-8" />
            </div>
            <h3 className="font-semibold mb-2">GitHub</h3>
            <span className="text-sm text-muted-foreground text-center">
              Check out my projects
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
