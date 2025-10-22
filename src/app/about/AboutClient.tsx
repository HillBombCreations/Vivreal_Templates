"use client";

import Image from "next/image";
import { useSiteData } from "@/contexts/SiteDataContext";

const teammates = [
  {
    name: "Will Cunnington",
    description: "Will Cunnington is a Chicago based standup comedian. He has a whimsical and fun vibe on stage.  Will loves to open up and connect to audiences with his vulnerable anecdotes about his strange and confusing upbringing as well as the oddities of navigating the world as an adult in today's day and age.\n\nHe has performed on stages such as Laugh Factory Chicago, Zanies Chicago, The Den Theatre, Second City, and more! Will also runs one of the hottest weekly open mics in Chicago - where he curates a fun and encouraging environment for comedians of all skill levels.",
    image: '/headshots/will.jpeg',
  },
  {
    name: "Tommy Saxton",
    description: "Tommy Saxton is a Chicago based standup comedian. He began his career in Asheville NC where he developed a silly and lighthearted stage presence, so you don't notice he says words like p****, a**, and of course, g**.  From Zanies to the Laugh Factory, Tommy has been making audiences feel a sense of warmth and kinship with his off-color humor. He mixes storytelling and self-depreciation to create a picture of a man(ish) at odds with how the world perceives him(mostly). Young people laugh with him, old people laugh at him, but everyone laughs.\n\nTommy has performed standup in clubs all over Chicago like the Laugh Factory, Zanies Oldtown, Zanies Rosemont, the Den Theatre, the Comedy Bar, Comedy Clubhouse, and the Lincoln Lodge. He has performed in shows with Pat McGann, Maggie Hughes DePalo, Kristen Toomey, and Hillary Begley. He recently won the Comedy Gazelle's Vouch competition, and he will be performing at the Windy Cidy Comedy Festival in August. He produces, books, and hosts a monthly showcase called Please Like Me at the Uptown Taproom, which sold out it's first show this July.",
    image: '/headshots/tommy.jpeg',
  },
  {
    name: "Nick Emeka",
    description: "Nick Emeka is a rising goblin in the Chicago comedy scene. Transplanted from Phoenix AZ, he has performed across the country at venues such as: The Laugh Factory, Zanies, The Den Theatre, The Vixen Theatre, House of Comedy Arizona, Detroit House of Comedy, Mic Drop Comedy Club, Stir Crazy Comedy Club, The Independent, and The Lincoln Lodge.\n\nNick has featured for some of the best comedians in the country, including Casey Rocket, Craig Conant, Eleanor Kerrigan, Jessie \"Jetski\" Johnson and Norm Stulz. Additionally, the fella has been a featured performer on the Blue Whale and Motor City comedy festivals. In November Nick won a spot as a featured performer for the Vouch Chicago auditions, which recognizes the best up and coming talents in the Second City.",
    image: '/headshots/nick.jpeg',
  },
];

// const funFacts = [
//   { number: "10+", label: "Years of combined experience" },
//   { number: "50+", label: "Projects launched" },
//   { number: "100%", label: "Commitment to quality" },
// ];

const AboutClient = () => {
  const siteData = useSiteData();

  return (
    <main className="pt-24 md:pt-32">
      <section className="mx-auto max-w-6xl px-6 mt-14">
        <h1 className="text-4xl md:text-4xl font-bold text-center mb-8">
          Meet the Team
        </h1>
        <p
          className="text-center max-w-2xl mx-auto mb-12"
          style={{ color: siteData?.["text-primary"] }}
        >
          Behind every product is a passionate team. Here&apos;s a glimpse of the
          people who make it possible.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-10">
          {teammates.map((member, idx) => (
            <div
              key={idx}
              className="
                group relative flex flex-col items-center text-center
                p-8 bg-white dark:bg-gray-800
                rounded-2xl shadow-md hover:shadow-xl
                transition-all duration-300
              "
            >
              <div
                className="
                  w-40 h-40 mb-6 rounded-full overflow-hidden
                  ring-4 ring-gray-100 dark:ring-gray-700
                  group-hover:ring-primary/60 transition-all duration-300
                "
              >
                <Image
                  src={member.image}
                  alt={member.name}
                  width={200}
                  height={200}
                  className="w-full h-full object-cover"
                />
              </div>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1">
                {member.name}
              </h3>

              <p className="text-sm text-gray-600 dark:text-gray-400 max-w-xs whitespace-pre-line">
                {member.description}
              </p>
            </div>
          ))}
        </div>
      </section>
      {/* <section className="mx-auto max-w-5xl px-6 mt-24 text-center">
        <h2 className="text-2xl md:text-3xl font-bold mb-8">A Few Fun Facts</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {funFacts.map((fact, i) => (
            <div
              key={i}
              style={{
                background: siteData?.surface,
                border: `1px solid ${siteData?.primary}`,
              }}
              className="rounded-xl p-8"
            >
              <p className="text-3xl font-bold text-primary">{fact.number}</p>
              <p
                className="text-sm mt-2"
                style={{ color: siteData?.["text-secondary"] }}
              >
                {fact.label}
              </p>
            </div>
          ))}
        </div>
      </section> */}
      <section className="mt-24 mx-auto max-w-4xl text-center px-6">
        <div className="space-y-6 bg-secondary/50 px-6 py-12 rounded-xl">
          <h2 className="text-2xl md:text-3xl font-display font-bold">
            Thanks for taking the time to learn more about our team!
          </h2>
          <p
            className="text-sm max-w-xl mx-auto"
            style={{ color: siteData?.["text-secondary"] }}
          >
            We&apos;re excited about the journey ahead and would love to have you with us!
          </p>
        </div>
      </section>
    </main>
  );
};

export default AboutClient;