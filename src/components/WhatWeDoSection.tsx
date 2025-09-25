import { ShieldCheck, Users, MessageSquare } from 'lucide-react'

const features = [
  {
    icon: ShieldCheck,
    title: "Reliable Support",
    description:
      "Our team is here around the clock to tackle any challenge, minimize downtime, and ensure your business runs seamlessly.",
  },
  {
    icon: Users,
    title: "Success Partnership",
    description:
      "You're never alone. Our dedicated team partners with you, providing proactive support and personalized training to help you thrive.",
  },
  {
    icon: MessageSquare,
    title: "Build With You",
    description:
      "We listen. Your community feedback shapes our roadmap so we build the tools you actually need to grow and succeed.",
  },
];

export default function WhatWeDoSection() {
  return (
    <section className="py-20 md:py-32 bg-secondary/50 relative overflow-hidden">
      <div className="content-grid mx-auto text-center animate-fade-in">
        <h2 className="text-3xl max-w-1xl text-start md:text-5xl font-display font-bold tracking-tight mb-12">
          <span className="text-primary">From questions to solutions</span> we make it happen together.
        </h2>
        <div className="grid md:grid-cols-3 gap-10">
          {features.map(({ icon: Icon, title, description }, i) => (
            <div
              key={i}
              className="flex flex-col items-center px-4 max-w-xs mx-auto"
              style={{
                animationDelay: `${i * 150}ms`,
                opacity: 0,
                animation: `fade-in-up 0.7s ease-out forwards`,
              }}
            >
              <Icon size={50} className="text-primary mb-6" />
              <div className="w-full">
                <h3 className="text-xl font-semibold text-center">{title}</h3>
              </div>
              <p className="text-gray-800 text-sm text-start mt-2 ml-5">{description}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="absolute -z-10 top-40 -left-20 h-64 w-64 bg-primary/5 rounded-full blur-3xl"></div>
      <div className="absolute -z-10 bottom-20 right-10 h-80 w-80 bg-primary/5 rounded-full blur-3xl"></div>
    </section>

  )
}
