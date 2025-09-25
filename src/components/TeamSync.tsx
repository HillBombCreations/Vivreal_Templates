import { useState, useEffect } from "react"
import {
  Users,
  UserCheck,
  BarChart2,
  Code,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import clsx from "clsx"

const ROLES = [
  {
    id: "community-manager",
    title: "Community Manager",
    icon: Users,
    color: 'blue-700',
    image: "/communityManager.png",
    points: [
      {
        title: "Post Updates Easily",
        description:
          "Quickly share announcements, events, and job openings with your community without needing technical skills. Keep your site fresh and engaging with minimal effort.",
      },
      {
        title: "Engage Your Audience",
        description:
          "Maintain a strong connection with your audience by delivering dynamic, timely content that resonates. Foster community loyalty through relevant and frequent updates.",
      },
      {
        title: "Manage User Feedback",
        description:
          "Track, organize, and respond to user comments or questions directly through Vivreal's platform, helping you build a responsive and interactive community.",
      },
    ],
  },
  {
    id: "team-lead",
    title: "Team Lead",
    icon: UserCheck,
    color: 'purple-700',
    image: "/teamLead.png",
    points: [
      {
        title: "Schedule Content",
        description:
          "Plan and automate content releases to ensure projects stay on schedule. Avoid last-minute publishing stress and maintain consistent communication with your team and audience.",
      },
      {
        title: "Coordinate Teams",
        description:
          "Utilize shared calendars and clear timelines within Vivreal to keep all team members aligned on upcoming tasks, deadlines, and launches for smooth project execution.",
      },
      {
        title: "Track Progress",
        description:
          "Monitor content updates, project milestones, and deadlines effortlessly using integrated dashboards, helping you identify bottlenecks and keep projects moving forward.",
      },
    ],
  },
  {
    id: "marketing-specialist",
    title: "Marketing Specialist",
    icon: BarChart2,
    color: 'red-700',
    image: "/marketingSpecialist.png",
    points: [
      {
        title: "Update Campaigns Fast",
        description:
          "React swiftly to market trends by modifying landing pages and promotional content instantly. Keep your campaigns fresh and maximize their impact without developer delays.",
      },
      {
        title: "Analyze Engagement",
        description:
          "Access detailed analytics on how users interact with your content to understand performance and optimize campaigns for better conversions and ROI.",
      },
      {
        title: "Collaborate Seamlessly",
        description:
          "Work closely with designers, developers, and managers within one unified platform to streamline marketing workflows and accelerate campaign launches.",
      },
    ],
  },
  {
    id: "developer",
    title: "Developer",
    icon: Code,
    color: 'green-700',
    image: "/developers.png",
    points: [
      {
        title: "Easy APIs & Docs",
        description:
          "Access well-documented, developer-friendly APIs that speed up integrations and custom functionality, reducing development time and errors.",
      },
      {
        title: "Save Time",
        description:
          "Automate routine content management tasks and focus on building innovative features, improving productivity and reducing repetitive work.",
      },
      {
        title: "Flexible Platform",
        description:
          "Customize and extend Vivreal's capabilities with a modular, flexible platform that adapts to your team's unique workflows and technical needs.",
      },
    ],
  },
]

export default function RolesSection() {
  const [activeRole, setActiveRole] = useState(ROLES[0].id);
  const [isMobile, setIsMobile] = useState(false);
  const currentRole = ROLES.find((role) => role.id === activeRole)!
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const togglePoint = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  useEffect(() => {
    setOpenIndex(0);
  }, [activeRole]);
  return (
    <section className="py-20 md:py-28 bg-white dark:bg-background">
      <div className="content-grid max-w-7xl mx-auto">
        <div className="text-center mb-5 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-display font-bold tracking-tight">
            Who <span className="text-primary">Benefits</span> from Vivreal?
          </h2>
          <p className="text-gray-800 text-lg mt-2 max-w-xl mx-auto">
            No matter your role, Vivreal helps your team collaborate and scale better.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4 mb-5 md:mb-12">
          {ROLES.map((role) => {
            const Icon = role.icon
            return (
              <button
                key={role.id}
                onClick={() => {
                  setActiveRole(role.id)
                  setOpenIndex(null)
                }}
                className={clsx(
                  "flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition",
                  activeRole === role.id
                    ? `border border-${role.color} text-${role.color} bg-white shadow`
                    : "bg-muted text-gray-800 hover:bg-muted/70"
                )}
              >
                <Icon className={`w-5 h-5 text-${role.color}`} />
                {role.title}
              </button>
            )
          })}
        </div>
        <div className="grid md:grid-cols-[2fr_1fr] gap-10 items-start">
          <div className="p-6 md:p-8 rounded-xl bg-white dark:bg-gray-900 animate-fade-in">
            {currentRole.points.map((point, i) => (
            <div key={i} className="mb-4 last:mb-0">
              <button
                onClick={() => togglePoint(i)}
                className="w-full flex justify-between items-center py-3 px-4 rounded-lg bg-muted hover:bg-muted/80 transition focus:outline-none"
              >
                <h3 className="text-lg font-semibold">{point.title}</h3>
                {openIndex === i ? (
                  <ChevronUp className="w-5 h-5 text-primary" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-primary" />
                )}
              </button>
              <div
                className={clsx(
                  "grid transition-all duration-300 ease-in-out overflow-hidden",
                  openIndex === i ? "grid-rows-[1fr] opacity-100 mt-2" : "grid-rows-[0fr] opacity-0"
                )}
              >
                <div className="overflow-hidden px-4">
                  <p className="text-gray-800">{point.description}</p>
                </div>
              </div>
            </div>
          ))}
          </div>
          {
            !isMobile && (
              <div className="w-full rounded-xl overflow-hidden shadow-lg animate-fade-in">
                <img
                  src={currentRole.image}
                  alt={`${currentRole.title} illustration`}
                  className="w-full h-auto object-contain"
                  loading="lazy"
                />
              </div>
            )
          }
        </div>
      </div>
    </section>
  )
}