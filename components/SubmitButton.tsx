'use client'
import { useFormStatus } from 'react-dom'

export default function SubmitButton({ children, className = 'btn', busy = 'Saving…' }: { children: React.ReactNode; className?: string; busy?: string }) {
  const { pending } = useFormStatus()
  return <button className={className} disabled={pending}>{pending ? busy : children}</button>
}
