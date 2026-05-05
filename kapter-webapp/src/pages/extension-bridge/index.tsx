import { SignInButton, useAuth } from "@clerk/react-router"
import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { useSearchParams } from "react-router"

import { Button } from "@/components/ui/button"

const BRIDGE_RESULT_MESSAGE_TYPE = "KAPTER_EXTENSION_TOKEN_BRIDGE_RESULT"
const BRIDGE_ACK_MESSAGE_TYPE = "KAPTER_EXTENSION_TOKEN_BRIDGE_ACK"

type BridgeStatus =
  | "missing-request"
  | "loading"
  | "sign-in"
  | "sending"
  | "waiting"
  | "confirmed"
  | "error"

interface BridgeAckMessage {
  source: "kapter-extension"
  type: typeof BRIDGE_ACK_MESSAGE_TYPE
  payload: {
    requestId: string
  }
}

const BRIDGE_TOKEN_TEMPLATE =
  import.meta.env.VITE_CLERK_EXTENSION_TOKEN_TEMPLATE?.trim() || null

function isBridgeAckMessage(value: unknown): value is BridgeAckMessage {
  if (!value || typeof value !== "object") {
    return false
  }

  const candidate = value as Partial<BridgeAckMessage>

  return (
    candidate.source === "kapter-extension" &&
    candidate.type === BRIDGE_ACK_MESSAGE_TYPE &&
    !!candidate.payload &&
    typeof candidate.payload.requestId === "string"
  )
}

export default function ExtensionBridgePage() {
  const { getToken, isLoaded, isSignedIn, userId } = useAuth()
  const { t } = useTranslation(["extensionBridge", "common"])
  const [searchParams] = useSearchParams()
  const requestId = searchParams.get("requestId")
  const shouldPromptForSignIn = !!requestId && isLoaded && !isSignedIn
  const [status, setStatus] = useState<BridgeStatus>(
    requestId ? "loading" : "missing-request"
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasPostedRef = useRef(false)

  useEffect(() => {
    if (!requestId) {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return
      }

      if (!isBridgeAckMessage(event.data)) {
        return
      }

      if (event.data.payload.requestId !== requestId) {
        return
      }

      setStatus("confirmed")
      setErrorMessage(null)
    }

    window.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("message", handleMessage)
    }
  }, [requestId])

  useEffect(() => {
    if (!requestId || !isLoaded || hasPostedRef.current) {
      return
    }

    if (!isSignedIn) {
      return
    }

    void (async () => {
      hasPostedRef.current = true
      setStatus("sending")
      setErrorMessage(null)

      try {
        const sessionToken = await getToken(
          BRIDGE_TOKEN_TEMPLATE
            ? {
                template: BRIDGE_TOKEN_TEMPLATE,
              }
            : undefined
        )

        if (!sessionToken) {
          throw new Error(
            "Clerk did not return a session token for the current session."
          )
        }

        window.postMessage(
          {
            source: "kapter-webapp",
            type: BRIDGE_RESULT_MESSAGE_TYPE,
            payload: {
              requestId,
              sessionToken,
              userId,
            },
          },
          window.location.origin
        )

        setStatus("waiting")
      } catch (error) {
        hasPostedRef.current = false
        setStatus("error")
        setErrorMessage(
          error instanceof Error
            ? error.message
            : t("prepareTokenError", { ns: "extensionBridge" })
        )
      }
    })()
  }, [getToken, isLoaded, isSignedIn, requestId, t, userId])

  return (
    <div className="relative min-h-svh overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(255,237,213,0.9),_rgba(255,255,255,1)_55%)] px-6 py-10 text-foreground">
      <div className="mx-auto flex min-h-[calc(100svh-5rem)] w-full max-w-3xl items-center justify-center">
        <div className="w-full overflow-hidden rounded-4xl border border-border/70 bg-card/95 shadow-[0_32px_100px_-48px_rgba(194,65,12,0.55)] backdrop-blur">
          <div className="border-b border-border/70 bg-gradient-to-r from-primary/10 via-transparent to-primary/5 px-8 py-7">
            <p className="text-sm font-medium tracking-[0.28em] text-primary/70 uppercase">
              {t("eyebrow", { ns: "extensionBridge" })}
            </p>
            <h1 className="mt-3 font-heading text-4xl text-balance text-foreground">
              {t("title", { ns: "extensionBridge" })}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
              {t("description", { ns: "extensionBridge" })}
            </p>
          </div>

          <div className="grid gap-6 px-8 py-8 md:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
            <section className="space-y-4">
              <div className="rounded-3xl border border-border/70 bg-background/80 p-5">
                <p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                  {t("statusTitle", { ns: "extensionBridge" })}
                </p>
                <p className="mt-3 text-2xl font-semibold text-foreground">
                  {status === "missing-request" &&
                    t("statuses.missing-request.title", {
                      ns: "extensionBridge",
                    })}
                  {status === "loading" &&
                    (shouldPromptForSignIn
                      ? t("statuses.loadingSignedOut.title", {
                          ns: "extensionBridge",
                        })
                      : t("statuses.loadingSignedIn.title", {
                          ns: "extensionBridge",
                        }))}
                  {status === "sign-in" &&
                    t("statuses.sign-in.title", { ns: "extensionBridge" })}
                  {status === "sending" &&
                    t("statuses.sending.title", { ns: "extensionBridge" })}
                  {status === "waiting" &&
                    t("statuses.waiting.title", { ns: "extensionBridge" })}
                  {status === "confirmed" &&
                    t("statuses.confirmed.title", { ns: "extensionBridge" })}
                  {status === "error" &&
                    t("statuses.error.title", { ns: "extensionBridge" })}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {status === "missing-request" &&
                    t("statuses.missing-request.description", {
                      ns: "extensionBridge",
                    })}
                  {status === "loading" &&
                    (shouldPromptForSignIn
                      ? t("statuses.loadingSignedOut.description", {
                          ns: "extensionBridge",
                        })
                      : t("statuses.loadingSignedIn.description", {
                          ns: "extensionBridge",
                        }))}
                  {status === "sign-in" &&
                    t("statuses.sign-in.description", {
                      ns: "extensionBridge",
                    })}
                  {status === "sending" &&
                    t("statuses.sending.description", {
                      ns: "extensionBridge",
                    })}
                  {status === "waiting" &&
                    t("statuses.waiting.description", {
                      ns: "extensionBridge",
                    })}
                  {status === "confirmed" &&
                    t("statuses.confirmed.description", {
                      ns: "extensionBridge",
                    })}
                  {status === "error" &&
                    t("statuses.error.description", {
                      ns: "extensionBridge",
                    })}
                </p>

                {errorMessage ? (
                  <p className="mt-4 rounded-2xl border border-destructive/20 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                    {errorMessage}
                  </p>
                ) : null}
              </div>

              {!isSignedIn || shouldPromptForSignIn || status === "sign-in" ? (
                <SignInButton>
                  <Button size="lg">
                    {t("actions.signInWithClerk", { ns: "common" })}
                  </Button>
                </SignInButton>
              ) : null}
            </section>

            <aside className="rounded-3xl border border-border/70 bg-muted/35 p-5">
              <p className="text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                {t("requestContext", { ns: "extensionBridge" })}
              </p>
              <dl className="mt-4 space-y-4 text-sm">
                <div>
                  <dt className="font-medium text-foreground">
                    {t("bridgeRequest", { ns: "extensionBridge" })}
                  </dt>
                  <dd className="mt-1 break-all text-muted-foreground">
                    {requestId ||
                      t("missingRequestId", { ns: "extensionBridge" })}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">
                    {t("signedInUser", { ns: "extensionBridge" })}
                  </dt>
                  <dd className="mt-1 break-all text-muted-foreground">
                    {userId || t("notSignedIn", { ns: "extensionBridge" })}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">
                    {t("bridgeOrigin", { ns: "extensionBridge" })}
                  </dt>
                  <dd className="mt-1 break-all text-muted-foreground">
                    {window.location.origin}
                  </dd>
                </div>
                <div>
                  <dt className="font-medium text-foreground">
                    {t("jwtTemplate", { ns: "extensionBridge" })}
                  </dt>
                  <dd className="mt-1 break-all text-muted-foreground">
                    {BRIDGE_TOKEN_TEMPLATE ||
                      t("defaultSessionToken", { ns: "extensionBridge" })}
                  </dd>
                </div>
              </dl>
            </aside>
          </div>
        </div>
      </div>
    </div>
  )
}
