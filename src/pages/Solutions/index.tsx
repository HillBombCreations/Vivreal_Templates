import { Helmet } from "react-helmet";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import GetStartedButton from "@/components/GetStartedButton";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import {
    Globe,
    ShoppingCart,
    Layers,
    ArrowRight,
    Users,
    LucideIcon,
    UserCheck,
    BarChart2,
    Code,
    Megaphone
} from "lucide-react";
import { Link } from "react-router-dom";

interface SolutionCardProps {
  title: string;
  description: string;
  link: string;
  icon: LucideIcon;
  color: string;
}

const solutions: SolutionCardProps[] = [
  {
    title: "Websites",
    description:
      "Create fast, flexible websites with structured content your team can manage with ease.",
    link: "/solutions/website",
    icon: Globe,
    color: "blue-700",
  },
  {
    title: "Content Hub",
    description:
      "Bring blogs, posts, and media together your single source of truth for published content.",
    link: "/solutions/content-hub",
    icon: Layers,
    color: "purple-700",
  },
  {
    title: "Multi-Channel Marketing",
    description:
      "Keep your brand consistent across web, email, and apps all from one place.",
    link: "/solutions/multichannel",
    icon: Megaphone,
    color: "red-700",
  },
  {
    title: "Sell Online",
    description:
      "Launch your online store, take payments, and manage your sales content effortlessly.",
    link: "/solutions/ecommerce",
    icon: ShoppingCart,
    color: "green-700",
  },
];

const rolesSupport = [
  {
    title: "Community Manager",
    image: '/communityManager.png',
    icon: Users,
    color: "blue-700",
    benefits: [
      "Keep your community engaged with easy-to-update pages for news, events, and discussions.",
      "Respond to questions or feedback with tools that centralize user interaction.",
      "Stay visible and relevant with dynamic content your audience actually wants to read.",
    ],
  },
  {
    title: "Team Lead",
    icon: UserCheck,
    color: "green-700",
    image: '/teamLead.png',
    benefits: [
      "Assign tasks and content ownership clearly across multiple teams.",
      "Ensure alignment with visual timelines and shared publishing calendars.",
      "Spot bottlenecks early using real-time dashboards and content flow tracking.",
    ],
  },
  {
    title: "Marketing Specialist",
    icon: BarChart2,
    color: "yellow-500",
    image: '/marketingSpecialist.png',
    benefits: [
      "Pivot quickly with editable content that doesn't require dev resources.",
      "Measure campaign performance with granular engagement insights.",
      "Launch updates across all channels in one place from emails to landing pages.",
    ],
  },
  {
    title: "Developer",
    icon: Code,
    color: "purple-700",
    image: '/developers.png',
    benefits: [
      "Use modular APIs and custom components to build fast, extensible features.",
      "Automate content delivery while staying in control of code and integrations.",
      "Save time by empowering non-technical teammates to manage site content safely.",
    ],
  },
];

const SolutionsPage = () => {
    const roleImages = {
        "Community Manager": "/communityManager.png",
        "Team Lead": "/teamLead.png",
        "Marketing Specialist": "/marketingSpecialist.png",
        Developer: "/developers.png",
    };

    const [activeIndex, setActiveIndex] = useState(0);

    const handlePrev = () => {
        setActiveIndex((prev) => (prev === 0 ? rolesSupport.length - 1 : prev - 1));
    };

    const handleNext = () => {
        setActiveIndex((prev) => (prev === rolesSupport.length - 1 ? 0 : prev + 1));
    };

    const currentRole = rolesSupport[activeIndex];
  return (
    <>
      <Helmet>
        <title>Vivreal Solutions | More Than a CMS</title>
        <link rel="canonical" href={'https://www.vivreal.io/solutions'} />
      </Helmet>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
            <div className="bg-blue-50 py-10 rounded-xl w-full space-y-6 text-center mx-auto -mb-10">
                <h1 className="text-3xl md:text-4xl md:text-5xl font-display font-bold tracking-tight animate-fade-in" style={{ animationDelay: "200ms" }}>
                Solutions built for <span className="text-primary">scale</span>
                </h1>
                <p className="inline-block text-gray-800 max-w-4xl text-md md:text-lg animate-fade-in" style={{ animationDelay: "300ms" }}>
                Enable your team to move faster and smarter with the tools and workflows that fit your business.
                </p>
                <div className="flex justify-center">
                  <GetStartedButton page="Solutions" color="primary" />
                </div>
            </div>
            <div className="grid gap-8 mt-20 md:grid-cols-2">
            {solutions.map((solution, index) => (
                <div key={index} className={`rounded-xl border border-primary/10 p-6 bg-white shadow-sm flex flex-col md:flex-row items-start gap-6`}>
                <solution.icon size={36} className={`text-${solution.color} w-9 h-9`} />
                <div>
                    <h2 className="text-xl font-semibold mb-2">{solution.title}</h2>
                    <p className="text-sm text-gray-800 mb-3">{solution.description}</p>
                    <Link
                      to={solution.link}
                      className={`inline-flex items-center gap-1 text-sm text-${solution.color} font-medium hover:underline`}
                    >
                    <span className="sr-only"> about {solution.title}</span>
                    Learn more <ArrowRight className={`w-4 h-4 text-${solution.color}`} />
                    </Link>
                </div>
                </div>
            ))}
            </div>
            <div className="mt-24">
              <h3 className="text-2xl md:text-3xl font-bold md:text-center mb-8">
                  How Vivreal Supports Your <span className="text-primary">Role</span>
              </h3>
              <p className="md:text-center text-gray-800 text-lg max-w-2xl mx-auto mb-12">
                  Whether you're managing a team, launching a campaign, or building the future Vivreal adapts to your role and workflow.
              </p>
                <div className="md:hidden flex items-center justify-end mb-4 text-sm text-gray-500 animate-bounce">
                  Swipe →
                </div>
                <Carousel opts={{ align: "center", loop: true }}>
                    <CarouselContent>
                    {rolesSupport.map((role, index) => (
                        <CarouselItem
                        key={index}
                        className="w-full md:basis-1/1 px-2 py-4 flex justify-center"
                        >
                        <div className="flex flex-col md:flex-row items-center justify-between gap-10 border border-primary/10 rounded-xl bg-white p-0  w-full max-w-6xl overflow-hidden">

                            {/* Left Content Block */}
                            <div className="md:w-1/2 h-full p-8 space-y-6 flex flex-col justify-center">
                                <div className="flex items-center gap-3">
                                <role.icon className="w-6 h-6 text-primary" />
                                <h3 className="text-2xl font-semibold text-primary">{role.title}</h3>
                                </div>
                                <ul className="list-disc list-inside text-gray-800 text-md space-y-4 pl-2">
                                {role.benefits.map((benefit, i) => (
                                    <li key={i}>{benefit}</li>
                                ))}
                                </ul>
                            </div>

                            {/* Right Image */}
                            <div className="md:w-1/2">
                                <img
                                src={role.image}
                                alt={role.title}
                                className="w-full h-full object-cover rounded-none"
                                />
                            </div>
                        </div>
                        </CarouselItem>
                    ))}
                    </CarouselContent>

                    {/* Carousel Controls */}
                    <div className="flex justify-center gap-4 mt-6">
                    <CarouselPrevious />
                    <CarouselNext />
                    </div>
                </Carousel>
            </div>
            {/* Insights / Growth Section */}
            <div className="mt-20 grid md:grid-cols-3 gap-6 text-center">
                <div className="bg-white border border-primary/10 rounded-lg p-6">
                <h3 className="font-semibold text-lg">Flexible Content Modeling</h3>
                <p className="text-sm text-gray-800 mt-2">
                    Customize data structures that mirror how your business actually works.
                </p>
                </div>
                <div className="bg-white border border-primary/10 rounded-lg p-6">
                <h3 className="font-semibold text-lg">Omnichannel Ready</h3>
                <p className="text-sm text-gray-800 mt-2">
                    Deliver structured content to websites, apps, portals, and beyond.
                </p>
                </div>
                <div className="bg-white border border-primary/10 rounded-lg p-6">
                <h3 className="font-semibold text-lg">Collaboration Built-In</h3>
                <p className="text-sm text-gray-800 mt-2">
                    Empower teams to work together seamlessly with roles and real-time workflows.
                </p>
                </div>
            </div>
           <div className="space-y-4 bg-secondary/50 px-5 py-10 rounded-xl text-center">
                <h2 className="text-2xl md:text-3xl font-display font-bold text-center">
                    Built to Fit Your Workflow
                </h2>
                <p className="text-gray-800 text-center">
                    Every team is different. Reach out to explore how Vivreal can support your goals with flexible, scalable solutions.
                </p>
                <Link
                    to="/contact"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-primary text-white hover:bg-primary/90 transition text-sm font-medium"
                >
                    Contact Us
                    <ArrowRight className="w-4 h-4" />
                </Link>
          </div>
        </section>
      </main>

      <CTASection page="" />
      <Footer />
    </>
  );
};

export default SolutionsPage;