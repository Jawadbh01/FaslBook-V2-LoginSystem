import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/shared/AuthProvider";

export const metadata: Metadata = {
  title: "FaslBook",
  description: "Farm Operating System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning={true}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
