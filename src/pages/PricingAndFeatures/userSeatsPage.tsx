import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Helmet } from 'react-helmet';

const UserSeatsPage = () => {
  return (
    <>
        <Helmet>
            <title>Vivreal Headless CMS | What are User Seats?</title>
            <meta name="description" content="Vivreal is a flexible, API-first headless CMS for modern businesses. Manage, deliver, and scale content seamlessly across web, mobile, and digital platforms." />
            <link rel="canonical" href={'https://www.vivreal.io/developers/userseats'} />
        </Helmet>
        <Navbar />
        <section className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden">
        <div className="content-grid max-w-4xl mx-auto">
            <div className="space-y-6 text-center">
            <span className="inline-block text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
                Manage your team access
            </span>

            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
                What are <span className="text-primary">User Seats</span>?
            </h1>

            <p className="text-gray-800 text-lg max-w-2xl mx-auto">
                User seats determine how many individuals can access and collaborate within a group on Vivreal. Each seat represents one user license associated with a specific group subscription.
            </p>

            <div className="text-center mt-16">
                <RouterLink to="/pricing">
                <Button size="lg" className="font-medium">
                    View pricing
                    <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                </RouterLink>
            </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mt-16">
            <div className="border rounded-xl p-6 shadow-sm bg-background">
                <h3 className="text-xl font-semibold mb-2">How User Seats Work</h3>
                <p className="text-gray-800 mb-4">
                Each group subscription includes a set number of user seats based on the chosen plan. These seats allow your team members to log in, contribute, and manage content within the group.
                </p>
                <ul className="text-sm space-y-2">
                <li>✓ Each seat corresponds to one user in a group</li>
                <li>✓ Users can contribute, update, and collaborate on content</li>
                <li>✓ User seats are exclusive to each group subscription</li>
                </ul>
            </div>

            <div className="border rounded-xl p-6 shadow-sm bg-background">
                <h3 className="text-xl font-semibold mb-2">Seat Limits & Upgrades</h3>
                <p className="text-gray-800 mb-4">
                If your group reaches the maximum number of user seats allowed by your subscription tier, you'll need to upgrade to add more users. This ensures your group has enough capacity to collaborate effectively.
                </p>
                <ul className="text-sm space-y-2">
                <li>✓ Upgrade your group's subscription to increase user seats</li>
                <li>✓ Manage your team size easily through the Vivreal dashboard</li>
                <li>✓ No extra charge for inactive users within your seat count</li>
                </ul>
            </div>

            <div className="border rounded-xl p-6 shadow-sm bg-background">
                <h3 className="text-xl font-semibold mb-2">Separate from Other Limits</h3>
                <p className="text-gray-800 mb-4">
                User seats are managed independently from other subscription limits like entries or integrations. This allows flexible scaling of your team without impacting your content quotas.
                </p>
                <ul className="text-sm space-y-2">
                <li>✓ Focus on growing your team at your own pace</li>
                <li>✓ Manage content limits separately for efficiency</li>
                </ul>
            </div>

            <div className="border rounded-xl p-6 shadow-sm bg-background">
                <h3 className="text-xl font-semibold mb-2">Roles Within Groups</h3>
                <p className="text-gray-800 mb-4">
                Currently, the only roles available within groups are <strong>Admin</strong> and <strong>Basic User</strong>. Both roles can contribute, update, and manage content, with admins having additional management privileges.
                </p>
                <p className="text-gray-800 mb-4">
                We plan to introduce more granular role-based access controls (RBAC) in the future to give you finer control over permissions and responsibilities.
                </p>
                <ul className="text-sm space-y-2">
                <li>✓ Admins manage users and settings</li>
                <li>✓ Basic users contribute and collaborate on content</li>
                <li>✓ More advanced roles coming soon</li>
                </ul>
            </div>
            </div>

            <div className="text-center mt-16">
            <RouterLink to="/pricing">
                <Button size="lg" className="font-medium">
                View pricing
                <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
            </RouterLink>
            </div>
        </div>

        <div className="absolute -z-10 -top-16 -left-16 h-64 w-64 bg-primary/10 rounded-full blur-3xl"></div>
        <div className="absolute -z-10 -bottom-16 -right-16 h-40 w-40 bg-primary/5 rounded-full blur-2xl"></div>
        </section>
    </>
  );
};

export default UserSeatsPage;