export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh w-full items-center justify-center bg-(--color-bg) p-6">
      <div className="flex w-full max-w-[400px] flex-col gap-5">{children}</div>
    </div>
  );
}
