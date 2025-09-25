import { Helmet } from "react-helmet";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import CTASection from "@/components/CTASection";
import { Link } from "react-router-dom";
import GetStartedButton from "@/components/GetStartedButton";
import {
    Users,
    Clock,
    Expand,
    CalendarClock,
    BarChart2,
    ClipboardList,
    ArrowRight,
    LucideIcon,
} from "lucide-react";

interface FeatureCardProps {
  title: string;
  description: string;
  link: string;
  icon: LucideIcon;
  color: string;
}

const KeyFeaturesPage = () => {
    const colorClasses = {
        "blue-700": "text-blue-700",
        "purple-700": "text-purple-700",
        "red-700": "text-red-700",
        "green-700": "text-green-700"
    };

    const features: FeatureCardProps[] = [
        {
            title: "Quick Updates",
            description:
            "Update your content instantly no dev cycles, no bottlenecks. Just click, edit, and publish.",
            link: "/features/quick-updates",
            icon: Clock,
            color: "blue-700"
        },
        {
            title: "Easy Scheduling",
            description:
            "Control exactly when content goes live with a simple, built-in scheduling calendar.",
            link: "/features/scheduling",
            icon: CalendarClock,
            color: "purple-700"
        },
        {
            title: "Data Insights",
            description:
            "Track platform usage, content growth, and team engagement with built-in analytics.",
            link: "/features/data-analytics",
            icon: BarChart2,
            color: "red-700"
        },
        {
            title: "Order Analytics",
            description:
            "Monitor ecommerce activity and sales performance when using the Stripe integration.",
            link: "/features/order-analytics",
            icon: ClipboardList,
            color: "green-700"
        },
    ];
  return (
    <>
      <Helmet>
        <title>Vivreal Overview | More Than a CMS</title>
        <link rel="canonical" href={'https://www.vivreal.io/features'} />
      </Helmet>

      <Navbar />

        <main className="pt-24 md:pt-32 pb-20 md:pb-32">
            <section className="mx-5 md:mx-20 md:px-12 space-y-16">
                <div className="bg-blue-50 px-5 md:px-0 py-10 py-10 rounded-xl order-2 w-full md:order-1 space-y-6 text-center mx-auto -mb-10">
                    <h1 className="text-3xl md:text-5xl w-full font-display font-bold tracking-tight animate-fade-in" style={{ animationDelay: '200ms' }}>
                        What Makes <span className="text-primary">Vivreal</span> Different
                    </h1>
                    <p className="inline-block text-gray-800 max-w-4xl text-md md:text-lg animate-fade-in" style={{ animationDelay: '300ms' }}>
                        Vivreal goes beyond content management. It's a modern platform designed to help businesses deliver structured, scalable digital experiences faster, smarter, and with more flexibility.
                    </p>
                    <div className="flex justify-center">
                        <GetStartedButton page="Features" color="primary" />
                    </div>
                </div>
                <div className="mt-14 grid gap-8 md:grid-cols-2">
                    {features.map((feature, index) => (
                    <div key={index} className={`rounded-xl border border-primary/10 p-6 bg-white shadow-sm flex flex-col md:flex-row items-start gap-6`}>
                        <feature.icon size={36} className={`${colorClasses[feature.color]} w-9 h-9`} />
                        <div>
                        <h2 className="text-xl font-semibold mb-2">{feature.title}</h2>
                        <p className="text-sm text-gray-800 mb-3">{feature.description}</p>
                        <Link
                            to={feature.link}
                            className={`inline-flex items-center gap-1 text-sm ${colorClasses[feature.color]} font-medium hover:underline`}
                        >
                            <span className="sr-only"> about {feature.title}</span>
                            Learn more <ArrowRight className={`w-4 h-4 ${colorClasses[feature.color]}`} />
                        </Link>
                        </div>
                    </div>
                    ))}
                </div>
                <div className="flex w-full flex-col md:flex-row gap-12 mx-auto py-16">
                    <div className="w-full md:w-3/5 space-y-8">
                        <h2 className="text-2xl md:text-3xl font-bold font-display">
                        Smarter Content Organization for Real Results
                        </h2>

                        {/* <div className="flex flex-wrap gap-4">
                        <Link to="/about/contentmanagement/collectiongroups">
                            <Button variant="secondary" className="flex items-center gap-2">
                            See How Teams Use It <ArrowRight size={16} />
                            </Button>
                        </Link>
                        <Link to="/about/contentmanagement/collectionobjects">
                            <Button variant="secondary" className="flex items-center gap-2">
                            Explore Real Examples <ArrowRight size={16} />
                            </Button>
                        </Link>
                        </div> */}

                        <p className="pb-10 text-gray-800">
                        Vivreal helps your team organize content the way your business works. Think of it as creating templates for your key processes like job postings, product listings, or service offerings so your team can work faster and stay consistent.
                        </p>

                        <div className="flex flex-col items-center gap-6 mt-10">
                            <div className="bg-white border border-primary rounded-lg p-6 w-72 text-center shadow-sm">
                                <h3 className="font-semibold text-lg">Collection: Job Posting</h3>
                                <p className="text-base font-medium">Reusable Format</p>
                                <p className="text-sm text-gray-800 mt-1">Keeps roles consistent across listings</p>
                            </div>

                            <div className="relative h-6 w-full">
                                <div className="absolute left-1/2 transform -translate-x-1/2 h-full border-l-4 border-primary"></div>
                            </div>

                            <div className="grid sm:grid-cols-2 gap-6">
                                {[
                                {
                                    title: "Front-End Developer",
                                    location: "Remote",
                                    type: "Full-time",
                                    pay: "$90K - $110K",
                                    postedDate: "2025-06-25",
                                },
                                {
                                    title: "Product Designer",
                                    location: "New York, NY",
                                    type: "Full-time",
                                    pay: "$85K - $100K",
                                    postedDate: "2025-06-20",
                                },
                                ].map((job, idx) => (
                                <div key={idx} className="border border-primary rounded-lg p-4 bg-white">
                                    <h4 className="font-semibold text-lg">{job.title}</h4>
                                    <p className="text-sm"><strong>Location:</strong> {job.location}</p>
                                    <p className="text-sm"><strong>Type:</strong> {job.type}</p>
                                    <p className="text-sm"><strong>Pay:</strong> {job.pay}</p>
                                    <p className="text-xs text-gray-800 mt-1">Posted: {job.postedDate}</p>
                                </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <div className="w-full md:w-2/5 flex flex-col gap-8">
                        <div className="bg-white border border-primary rounded-xl px-5 py-5 space-y-6 shadow-sm">
                            <h3 className="text-xl md:text-2xl font-bold font-display flex items-center gap-3">
                                <Expand className="w-6 h-6 text-primary" />
                                Expand the Platform as You Grow
                            </h3>
                            <p className="text-gray-800">
                                As your business scales, Vivreal scales with you. Soon, developers and partners will be able to create custom tools, integrations, and solutions tailored specifically to your needs.
                            </p>
                            <ul className="list-disc space-y-3 text-gray-800">
                                <li className="ml-5">
                                Integrate with your existing systems
                                </li>
                                <li className="ml-5">
                                Custom-fit Vivreal to your workflows
                                </li>
                                <li className="ml-5">
                                Tap into a marketplace of business-ready solutions
                                </li>
                            </ul>
                        </div>
                        <div className="bg-white border border-primary rounded-xl px-5 py-5 space-y-6 shadow-sm">
                            <h4 className="text-xl md:text-2xl font-bold font-display flex items-center gap-3">
                                <Users className="w-6 h-6 text-primary" />
                                Built With You, Not Just For You
                            </h4>
                            <p className="text-gray-800">
                                Vivreal evolves with real business needs in mind. Your feedback shapes our roadmap, ensuring we solve the problems that matter most to your organization.
                            </p>
                            <ul className="list-disc space-y-3 text-gray-800">
                                <li className="ml-5">
                                Influence what features get built next
                                </li>
                                <li className="ml-5">
                                Get early access to innovations
                                </li>
                                <li className="ml-5">
                                Be part of a growing, collaborative business community
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>
                <div className="space-y-6 text-start mx-auto">
                    <h3 className="text-2xl md:text-3xl font-display font-bold">
                        Designed to Scale With Your Vision
                    </h3>
                    <p className="text-gray-800 text-start text-lg">
                        Whether you're launching your first product or managing a growing business, Vivreal adapts to your needs. Our platform supports everything from simple content models to deeply integrated, multi-channel ecosystems.
                    </p>
                    <div className="grid sm:grid-cols-3 text-start gap-6 pt-6">
                        <div className="bg-white border border-primary/10 rounded-lg p-6">
                        <h3 className="font-semibold text-lg">Flexible Content Modeling</h3>
                        <p className="text-sm text-gray-800 mt-2">
                            Create and customize data structures that mirror how your business actually works no rigid templates.
                        </p>
                        </div>
                        <div className="bg-white border border-primary/10 text-start rounded-lg p-6">
                        <h3 className="font-semibold text-lg">Omnichannel Ready</h3>
                        <p className="text-sm text-gray-800 mt-2">
                            Deliver structured content to websites, apps, portals, and beyond all from a single source of truth.
                        </p>
                        </div>
                        <div className="bg-white border border-primary/10 text-start rounded-lg p-6">
                        <h3 className="font-semibold text-lg">Collaboration Built-In</h3>
                        <p className="text-sm text-gray-800 mt-2">
                            Empower teams to work together seamlessly with roles, permissions, and real-time content workflows.
                        </p>
                        </div>
                    </div>
                </div>
                <div className="space-y-4 bg-secondary/50 px-5 py-10 rounded-xl text-center">
                    <h3 className="text-2xl md:text-3xl font-display font-bold text-center">
                    We're Just Getting Started
                    </h3>
                    <p className="text-gray-800 text-center">
                    New features, resources, and documentation are on the way. Vivreal is a long-term platform investment and we're building it hand-in-hand with forward-thinking teams like yours.
                    </p>
                </div>
            </section>
        </main>

        <CTASection page=""/>
        <Footer />
    </>
  );
};

export default KeyFeaturesPage;