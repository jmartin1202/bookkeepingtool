type Props = {
  error?: string;
  message?: string;
};

export function AuthMessage({ error, message }: Props) {
  if (!error && !message) return null;

  return (
    <div
      className={
        error
          ? "rounded-md border border-coral/25 bg-coral/10 px-4 py-3 text-sm font-medium text-coral"
          : "rounded-md border border-moss/25 bg-moss/10 px-4 py-3 text-sm font-medium text-moss"
      }
    >
      {error ?? message}
    </div>
  );
}
