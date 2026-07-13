import { SignInForm } from "@/components/auth/sign-in-form";
import { CosmicScene } from "@/components/auth/cosmic-scene";

export default function SignInPage() {
  return (
    <main className="min-h-[100dvh] flex flex-col lg:flex-row">
      <div className="flex-1 flex items-center justify-center py-8 lg:py-0">
        <SignInForm />
      </div>

      <div className="hidden lg:flex flex-1">
        <CosmicScene />
      </div>

      <div className="lg:hidden">
        <div className="h-48 overflow-hidden rounded-b-3xl">
          <CosmicScene />
        </div>
      </div>
    </main>
  );
}
