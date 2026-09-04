"use client";

/** زر يطلب تأكيدًا قبل تنفيذ إجراء لا رجعة فيه */
export default function ConfirmButton({
  message,
  children,
  className = "btn btn-danger text-sm",
}: {
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
