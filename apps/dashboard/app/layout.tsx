export const metadata = {
  title: "ReadyCheck AI",
  description: "AI-powered production readiness platform",
};

// Runs before first paint so a saved light theme doesn't flash dark.
const themeInitScript = `try{var t=localStorage.getItem("rc_theme");document.documentElement.dataset.theme=t==="light"?"light":"dark"}catch(e){document.documentElement.dataset.theme="dark"}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0 }}>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {children}
      </body>
    </html>
  );
}
