import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Sparkles } from "lucide-react"
import { useTranslation } from "react-i18next"

import { DashboardProjectsPanel } from "@/features/projects/components/dashboard-projects-panel"

type DashboardProjectSetupAccordionProps = React.ComponentProps<
  typeof DashboardProjectsPanel
>

export function DashboardProjectSetupAccordion(
  props: DashboardProjectSetupAccordionProps
) {
  const { t } = useTranslation("dashboard")

  return (
    <Accordion
      className="border-border/70 bg-background/90 shadow-md shadow-foreground/5 dark:border-white/10 dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(15,23,42,0.82))]"
      collapsible
      type="single"
    >
      <AccordionItem value="project-setup">
        <AccordionTrigger className="items-center px-6 py-5 hover:no-underline">
          <span className="inline-flex items-center gap-2">
            <Sparkles className="size-4 text-primary dark:text-orange-200" />
            {t("projectSetupAccordion.title")}
          </span>
        </AccordionTrigger>
        <AccordionContent className="px-2 pb-2">
          <DashboardProjectsPanel {...props} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
