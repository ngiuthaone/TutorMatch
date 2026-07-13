import { IconChalkboardTeacher, IconArrowRight } from "@tabler/icons-react";

export function ShareBanner() {
  return (
    <section className="py-16">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-8">
        <div className="relative rounded-3xl bg-gradient-to-br from-primary/10 via-primary/5 to-accent/10 border border-primary/10 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full translate-y-1/4 -translate-x-1/4 blur-3xl" />
          </div>

          <div className="relative z-10 px-8 lg:px-16 py-12 lg:py-16 flex flex-col lg:flex-row items-center justify-between gap-8">
            <div className="flex items-start gap-5">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                <IconChalkboardTeacher size={24} className="text-primary" />
              </div>
              <div>
                <h2 className="text-xl lg:text-2xl font-semibold tracking-tight text-foreground">
                  Something you know could be exactly what someone else needs.
                </h2>
                <p className="mt-2 text-sm text-muted max-w-xl">
                  Share a post, publish a tutorial, offer a session, or start building your community.
                </p>
              </div>
            </div>

            <a
              href="#"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-white font-medium text-sm hover:bg-primary-dark transition-all shrink-0"
            >
              Start sharing
              <IconArrowRight size={16} />
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
