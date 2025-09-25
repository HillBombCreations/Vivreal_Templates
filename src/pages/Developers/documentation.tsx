import { useEffect } from "react";
import { Helmet } from "react-helmet";
import { ArrowRight, BookOpen, Code, FileCode } from "lucide-react";

import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const DocumentationPage = () => {
    useEffect(() => {
        // Dynamically load Postman button script after component renders
        const script = document.createElement("script");
        script.src = "https://run.pstmn.io/button.js";
        script.async = true;
        document.body.appendChild(script);

        return () => {
        // clean up script if needed
        document.body.removeChild(script);
        };
    }, []);

    const resources = [
        {
        title: "Vivreal Docs",
        description: "Core documentation: getting started, integrations, and CMS features.",
        link: "https://docs.vivreal.io/",
        icon: FileCode,
        },
        {
        title: "GitBook Developer Docs",
        description: "In-depth API reference and technical guides for advanced use.",
        link: "https://vivreal.gitbook.io/api/",
        icon: BookOpen,
        },
        {
        title: "Postman Collection",
        description: "Run and test Vivreal's public APIs in Postman.",
        link: "https://www.postman.com/vivreal",
        postman: true,
        icon: Code,
        },
    ];

  return (
    <>
      <Helmet>
        <title>Vivreal Documentation</title>
        <meta
          name="description"
          content="Official documentation for the Vivreal platform APIs, SDKs, integration guides, and technical tutorials."
        />
        <link rel="canonical" href={'https://www.vivreal.io/developers/documentation'} />
      </Helmet>

      <Navbar />

      <main className="pt-24 md:pt-32 pb-20 md:pb-32">
        <section className="mx-5 md:mx-20 md:px-12 space-y-16">
          <div className="bg-blue-50 px-5 md:px-0 py-10 rounded-xl text-center space-y-6">
            <h1 className="text-3xl md:text-5xl font-display font-bold tracking-tight">
              Explore the <span className="text-blue-700">Vivreal Docs</span>
            </h1>
            <p className="text-gray-800 max-w-3xl mx-auto text-md md:text-lg">
              Everything you need to build, extend, and launch with Vivreal. Find setup guides, advanced API docs, and technical references in one place.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {resources.map((doc, idx) =>
              doc.postman ? (
                <div
                  key={idx}
                  className="border rounded-lg p-6 hover:shadow-md transition flex flex-col justify-between"
                >
                  <div>
                    <doc.icon className="w-6 h-6 text-primary mb-4" />
                    <h2 className="font-semibold text-lg">{doc.title}</h2>
                    <p className="text-sm text-gray-800 mt-1">{doc.description}</p>
                  </div>
                  <div className="mt-6 flex flex-row sm:items-center gap-8">
                    <a
                      href={doc.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
                    >
                      View docs <ArrowRight size={14} />
                    </a>
                    <div
                      className="postman-run-button"
                      data-postman-action="collection/fork"
                      data-postman-visibility="public"
                      data-postman-var-1="47694755-74d93529-f462-4551-ae50-ab17f0f01a08"
                      data-postman-collection-url="entityId=47694755-74d93529-f462-4551-ae50-ab17f0f01a08&entityType=collection&workspaceId=e70746de-bc98-49f3-bdc0-2e7e39f1ba59"
                    ></div>
                  </div>
                </div>
              ) : (
                <a
                  key={idx}
                  href={doc.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="border rounded-lg p-6 hover:shadow-md transition block"
                >
                  <doc.icon className="w-6 h-6 text-blue-700 mb-4" />
                  <h2 className="font-semibold text-lg">{doc.title}</h2>
                  <p className="text-sm text-gray-800 mt-1">{doc.description}</p>
                  <div className="mt-4 text-sm font-medium text-blue-700 flex items-center gap-1">
                    View docs <ArrowRight size={14} />
                  </div>
                </a>
              )
            )}
          </div>

          {/* Helpful Info / Guidance */}
          <div className="border-t pt-12 text-center space-y-4">
            <h2 className="text-2xl font-semibold">New to Vivreal?</h2>
            <p className="text-gray-800 max-w-xl mx-auto">
              Start with the main docs to get familiar with the platform. Use GitBook for deeper API reference, and try out the Postman collection to explore endpoints hands-on.
            </p>
            <p className="text-sm text-gray-800">
              Need help? Join our{" "}
              <a href="https://discord.gg/n3umGKGt" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Discord community
              </a>{" "}
              or reach out via support.
            </p>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
};

export default DocumentationPage;