import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Link as RouterLink } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { Helmet } from 'react-helmet';

const GroupsPage = () => {
  return (
    <>
      <Helmet>
        <title>Vivreal Headless CMS | What are Groups?</title>
        <meta name="description" content="Vivreal is a flexible, API-first headless CMS for modern businesses. Manage, deliver, and scale content seamlessly across web, mobile, and digital platforms." />
        <link rel="canonical" href={'https://www.vivreal.io/developers/groups'} />
      </Helmet>
      <Navbar />
      <section className="relative pt-24 md:pt-32 pb-20 md:pb-32 overflow-hidden">
        <div className="content-grid max-w-4xl mx-auto">
          <div className="space-y-6 text-center">
            <span className="inline-block text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
              Organize your workspaces
            </span>

            <h1 className="text-4xl md:text-5xl font-display font-bold tracking-tight">
              What are <span className="text-primary">Groups</span>?
            </h1>

            <p className="text-gray-800 text-lg max-w-2xl mx-auto">
              Groups are isolated workspaces where users collaborate on collections, objects, and content. All content belongs to a group and is completely separate from other groups.
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
              <h3 className="text-xl font-semibold mb-2">Group Subscriptions</h3>
              <p className="text-gray-800 mb-4">
                Subscriptions are tied to the group not your account. If you upgrade <strong>Group A</strong> to the Basic tier, <strong>Group B</strong> remains on its current plan.
              </p>
              <ul className="text-sm space-y-2">
                <li>✓ Each group must subscribe separately</li>
                <li>✓ Tier controls entries, integrations, and features</li>
                <li>✓ If your group hits its limits, upgrading is required to expand capacity</li>
              </ul>
            </div>

            <div className="border rounded-xl p-6 shadow-sm bg-background">
              <h3 className="text-xl font-semibold mb-2">Getting Started with Groups</h3>
              <p className="text-gray-800 mb-4">
                When you create a Vivreal account, you either create a new group or join an existing one using an invite or join code.
              </p>
              <ul className="text-sm space-y-2">
                <li>✓ All content is scoped to the group you're in</li>
                <li>✓ Switching groups shows entirely different content</li>
                <li>✓ Easily manage multiple brands, clients, or projects</li>
              </ul>
            </div>

            <div className="border rounded-xl p-6 shadow-sm bg-background">
              <h3 className="text-xl font-semibold mb-2">Isolated Content Per Group</h3>
              <p className="text-gray-800 mb-4">
                If you create collections and objects in <strong>Group A</strong>, switching to <strong>Group B</strong> means you won't see anything from Group A each group is fully isolated.
              </p>
              <ul className="text-sm space-y-2">
                <li>✓ Clear separation between clients or teams</li>
                <li>✓ Prevent accidental edits across projects</li>
              </ul>
            </div>

            <div className="border rounded-xl p-6 shadow-sm bg-background">
              <h3 className="text-xl font-semibold mb-2">Collaborate Within Your Group</h3>
              <p className="text-gray-800 mb-4">
                All users within a group can contribute, update, and manage the content for that group, fostering seamless collaboration.
              </p>
              <ul className="text-sm space-y-2">
                <li>✓ Everyone in the group shares access to the same content</li>
                <li>✓ Manage your projects efficiently as a team</li>
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

export default GroupsPage;