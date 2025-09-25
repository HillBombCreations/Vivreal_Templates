import { useState, useEffect } from "react"
import {
  BarChart2,
  Calendar,
  ClipboardList,
  Clock,
  ArrowRight,
} from "lucide-react"
import clsx from "clsx"

const TABS = [
  {
    id: "quick-updates",
    title: "Quick Updates",
    icon: Clock,
    color: 'blue-700',
    description:
      "Make changes to your site in seconds. With Vivreal, updating your content is fast, intuitive, and doesn't require a developer just click, update, and publish.",
    gif: "/quickUpdates.gif",
    path: "/features/quick-updates"
    
  },
  {
    id: "easy-scheduling",
    title: "Easy Scheduling",
    icon: Calendar,
    color: 'purple-700',
    description:
      "Plan and control when your content goes live with built-in scheduling. Use a simple calendar interface to automate publishing and stay organized with upcoming updates.",
    gif: "/scheduling.gif",
    path: "/features/scheduling"
  },
  {
    id: "data-analytics",
    title: "Data Analytics",
    icon: BarChart2,
    color: 'red-700',
    description:
      "Get a clear overview of how your team is using Vivreal. Track Vivrecords created, objects added, media uploaded, group users, active integrations, and more all from one dashboard.",
    gif: "/dataAnalytics.gif",
    path: "/features/data-analytics"
  },
  {
    id: "order-analytics",
    title: "Order Analytics",
    icon: ClipboardList,
    color: 'green-700',
    description:
      "If you're using the Stripe integration, monitor your store's performance with detailed order analytics. View sales trends, top products, revenue over time, and gain insights to grow your business.",
    gif: "/orderAnalytics.gif",
    path: "/features/order-analytics"
  }
]

export default function FeaturesGifSection() {
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  const [isMobile, setIsMobile] = useState(false);
  const currentTab = TABS.find((tab) => tab.id === activeTab)
  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 767px)");

    const handleChange = (e: MediaQueryListEvent) => {
      setIsMobile(e.matches);
    };

    setIsMobile(mediaQuery.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);
  return (
    <section className="py-16 md:py-28 bg-background dark:bg-background">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 md:mb-16">
          <h2 className="text-3xl sm:text-4xl font-display font-bold tracking-tight">
            Platform <span className="text-primary">Features</span>
          </h2>
          <p className="text-gray-800 text-base sm:text-lg mt-2 max-w-md mx-auto">
            Powerful tools to streamline your workflow and scale operations.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-3 mb-8 md:mb-12">
          {TABS.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={clsx(
                  "flex items-center gap-2 px-5 py-3 rounded-full text-sm sm:text-base font-medium transition",
                  activeTab === tab.id
                    ? `border border-${tab.color} text-${tab.color} bg-white shadow`
                    : "bg-muted text-gray-800 hover:bg-muted/70"
                )}
              >
                <Icon className={`w-5 h-5 text-${tab.color}`} />
                {tab.title}
              </button>
            )
          })}
        </div>
        <div className="grid md:grid-cols-[1fr_2fr] gap-8 items-start">
          <div className="p-6 sm:p-8 md:p-10 rounded-3xl flex flex-col justify-between w-full transition-all animate-fade-in">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-2xl md:text-3xl leading-snug text-gray-900 dark:text-white">
                  {currentTab.title}
                </h3>
              </div>
              <p className="text-gray-700 dark:text-gray-300 text-base sm:text-lg leading-relaxed font-medium">
                {currentTab.description}
              </p>
            </div>
            <div className="mt-6 sm:mt-8">
              <a
                href={currentTab.path}
                className={`inline-flex items-center gap-2 text-${currentTab.color} text-md hover:underline`}
              >
                Explore {currentTab.title} <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
          {
            !isMobile && (
              <div className="w-full overflow-hidden">
                <img
                  key={currentTab.id}
                  src={currentTab.gif}
                  className="mx-auto rounded-2xl shadow-md"
                  alt={currentTab.title}
                />
              </div>
            )
          }
        </div>
      </div>
    </section>
  )
}