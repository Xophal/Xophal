import ProfilePhoto from "@/components/about/ProfilePhoto";

type SocialLink = {
  label: string;
  href: string;
};

type TeamMember = {
  name: string;
  role: string;
  bio: string;
  photoSlug: string;
  photoAlt: string;
  photoShape: "portrait" | "square";
  photoPosition?: "top" | "left";
  pills: readonly string[];
  socialLinks?: readonly SocialLink[];
};

type TeamGroup = {
  id: string;
  title: string;
  description: string;
  layout: "featured" | "grid" | "developer";
  members: readonly TeamMember[];
};

const TEAM_GROUPS: readonly TeamGroup[] = [
  {
    id: "founder",
    title: "Founder",
    description: "The belief and experience behind Xophol.",
    layout: "featured",
    members: [
      {
        name: "Biplob Das",
        role: "Founder, Xophol",
        bio: "Biplob Das is the founder of Xophol, an educational initiative built on a simple belief: quality learning should be within every student's reach. He combines a scientific foundation, hands-on teaching experience and a working knowledge of technology to build a platform where students learn with confidence and educators share what they know. Biplob holds a B.Sc. in Chemistry with Physics and Mathematics. He spent six years as a chemist at Aqua Green and Aideobarie Tea Estate, then turned to teaching: six years as a private teacher and five years as founder and managing director of Ambition Coaching Centre and Evolution Coaching Centre. With a background in computer applications, he links classroom experience with modern technology.",
        photoSlug: "biplob-das",
        photoAlt: "Biplob Das, Founder of Xophol",
        photoShape: "portrait",
        pills: [
          "B.Sc. Chemistry, Physics and Maths",
          "6 years as a chemist",
          "11 years in teaching and coaching",
        ],
      },
    ],
  },
  {
    id: "teachers",
    title: "Teachers",
    description: "Educators sharing their knowledge and experience.",
    layout: "grid",
    members: [
      {
        name: "[Teacher Name]",
        role: "Teacher, Xophol",
        bio: "Ten years of teaching experience, from private tuition to an Assistant Teacher role under the Directorate of Elementary Education. Holds an M.A. in Mass Communication and Journalism from Tezpur University and an M.A. in English from Krishna Kanta Handiqui State Open University. D.El.Ed holder; qualified CTET and NET (2019); qualified for the Gandhi Fellowship under the Piramal Foundation.",
        photoSlug: "teacher",
        photoAlt: "Teacher portrait",
        photoShape: "square",
        photoPosition: "left",
        pills: ["M.A. English", "M.A. Mass Communication", "NET 2019", "CTET", "D.El.Ed"],
      },
    ],
  },
  {
    id: "developer",
    title: "Developer",
    description: "The hands-on work behind the Xophol platform.",
    layout: "developer",
    members: [
      {
        name: "Jayanta Borah",
        role: "Lead Web Developer, Xophol",
        bio: "Jayanta Borah is the Lead Web Developer and the only technical member of the Xophol team. Driven by curiosity for new technology, Jayanta designs, builds, secures and tests the platform and creates its content, learning each skill hands-on while shipping real features to real students.",
        photoSlug: "jayanta-borah",
        photoAlt: "Jayanta Borah, Lead Web Developer at Xophol",
        photoShape: "square",
        pills: ["Design", "Development", "Security and testing", "Content and marketing"],
      },
    ],
  },
];

function MemberPills({ pills }: { pills: readonly string[] }) {
  return (
    <ul className="mt-6 flex flex-wrap gap-2" aria-label="Highlights">
      {pills.map((pill) => (
        <li
          key={pill}
          className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium leading-5 text-muted-foreground sm:text-sm"
        >
          {pill}
        </li>
      ))}
    </ul>
  );
}

function SocialLinks({ links }: { links?: readonly SocialLink[] }) {
  if (!links?.length) return null;

  return (
    <ul className="mt-5 flex flex-wrap gap-4 text-sm font-medium">
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-sm text-xophol-blue underline decoration-xophol-blue/40 underline-offset-4 hover:decoration-xophol-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xophol-orange dark:text-sky-300 dark:decoration-sky-300/40"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function MemberDetails({ member }: { member: TeamMember }) {
  return (
    <div className="min-w-0">
      <p className="text-sm font-semibold text-xophol-orange">{member.role}</p>
      <h4 className="mt-2 text-2xl font-semibold tracking-tight text-card-foreground sm:text-3xl">
        {member.name}
      </h4>
      <p className="mt-4 max-w-prose text-sm leading-7 text-muted-foreground sm:text-base sm:leading-7">
        {member.bio}
      </p>
      <MemberPills pills={member.pills} />
      <SocialLinks links={member.socialLinks} />
    </div>
  );
}

export default function TeamSection() {
  return (
    <section
      aria-labelledby="team-heading"
      className="border-y border-border bg-muted/40 py-16 sm:py-20"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 max-w-2xl sm:mb-14">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-xophol-blue dark:text-sky-300">
            The people behind the platform
          </p>
          <h2 id="team-heading" className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Meet the Xophol team
          </h2>
        </div>

        <div className="space-y-12 sm:space-y-16">
          {TEAM_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`${group.id}-heading`}>
              <div className="mb-5">
                <h3 id={`${group.id}-heading`} className="text-xl font-semibold tracking-tight sm:text-2xl">
                  {group.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{group.description}</p>
              </div>

              {group.layout === "featured" && (
                <article className="grid overflow-hidden rounded-3xl border border-border bg-card lg:grid-cols-[minmax(240px,0.82fr)_1.5fr]">
                  {group.members.map((member) => (
                    <div key={member.photoSlug} className="grid lg:contents">
                      <ProfilePhoto
                        photoSlug={member.photoSlug}
                        name={member.name}
                        alt={member.photoAlt}
                        shape={member.photoShape}
                        position={member.photoPosition}
                        className="aspect-[3/4] w-full max-h-[34rem] self-start"
                      />
                      <div className="p-6 sm:p-8 lg:p-10">
                        <MemberDetails member={member} />
                      </div>
                    </div>
                  ))}
                </article>
              )}

              {group.layout === "grid" && (
                <div className="grid gap-5 md:grid-cols-2">
                  {group.members.map((member) => (
                    <article
                      key={member.photoSlug}
                      className="flex flex-col overflow-hidden rounded-3xl border border-border bg-card sm:flex-row sm:items-start"
                    >
                      <ProfilePhoto
                        photoSlug={member.photoSlug}
                        name={member.name}
                        alt={member.photoAlt}
                        shape={member.photoShape}
                        position={member.photoPosition}
                        className="aspect-square w-full shrink-0 self-start sm:w-40 md:w-44"
                      />
                      <div className="min-w-0 p-5 sm:p-6">
                        <MemberDetails member={member} />
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {group.layout === "developer" &&
                group.members.map((member) => (
                  <article
                    key={member.photoSlug}
                    className="grid overflow-hidden rounded-3xl border border-border bg-card md:grid-cols-[minmax(180px,0.45fr)_1fr]"
                  >
                    <ProfilePhoto
                      photoSlug={member.photoSlug}
                      name={member.name}
                      alt={member.photoAlt}
                      shape={member.photoShape}
                      position={member.photoPosition}
                      className="aspect-square w-full max-h-72 self-start md:w-full md:max-h-none"
                    />
                    <div className="p-6 sm:p-8 lg:p-10">
                      <MemberDetails member={member} />
                    </div>
                  </article>
                ))}
            </section>
          ))}
        </div>
      </div>
    </section>
  );
}
