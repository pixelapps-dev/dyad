export default function ContactPage() {
  return (
    <section className="mx-auto max-w-2xl px-6 py-24">
      <h1 className="text-4xl font-bold">Book a demo</h1>
      <p className="mt-4 text-slate-600">
        Tell us about your team and we'll get back within one business day.
      </p>
      <form
        className="mt-8 space-y-5"
        action="/api/lead"
        method="post"
        noValidate
      >
        <Field label="Work email" name="email" type="email" required />
        <Field label="Your name" name="name" required />
        <Field label="Company" name="company" required />
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="message">
            What are you trying to solve?
          </label>
          <textarea
            id="message"
            name="message"
            rows={4}
            className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>
        <button
          type="submit"
          className="rounded-full bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
        >
          Send
        </button>
      </form>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium" htmlFor={name}>
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="w-full rounded-md border border-slate-300 px-3 py-2 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
      />
    </div>
  );
}
