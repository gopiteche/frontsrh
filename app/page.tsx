import Image from "next/image";
import ReferralsPage from "./referrals/page";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-3 bg-white shadow-sm">
        <div className="flex items-center gap-2">
          <Image
            src="/images/logo.png"
            alt="Logo"
            width={36}
            height={36}
            className="object-contain"
          />
          <span className="text-lg font-semibold text-gray-800">
            SRH
          </span>
        </div>
      </header>

      {/* Page Content */}
      <main className="p-4">
        <ReferralsPage />
      </main>
    </div>
  );
}
