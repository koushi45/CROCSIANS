import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "CROCSIANS",
  description: "拠点を育て、仲間と探索するリアルタイムJRPGシミュレーション",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
      </body>
    </html>
  );
}
