import db from "@/services/db";
import { server_GetUserSession } from "@/supertokens/utils";
import { eq, lte, and } from "drizzle-orm";
import { desc } from "drizzle-orm/sql/expressions/select";
import dayjs from "dayjs";
import React from "react";
import { Button, Paper } from "@mantine/core";
import ProcessBotRecording from "@/app/(protected)/meetings/_components/processBotRecording";
import { Meeting } from "@/services/db/schema/meeting";
import Link from "next/link";
import Paths from "@/constants/paths";
import RecordingPlayer from "./_components/recordingPlayer";
import Image from "next/image";
import { IconPlugConnected } from "@tabler/icons-react";
import { Installation } from "@/services/db/schema/installation";

export default async function Integrations() {
  const session = await server_GetUserSession();
  const userId = session?.getUserId();
  if (!userId) {
    // user is not unauthorised
    return null;
  }

  let installations = await db.query.Installation.findMany({
    where: eq(Installation.userId, userId),
    columns: { integrationId: true },
  });

  // TODO: Paginate
  // TODO: Only fetch bots that are done recording (joinAt < today || null)
  let meetings = await db.query.Meeting.findMany({
    where: and(
      eq(Meeting.userId, userId!),
      lte(Meeting.joinAt, new Date()),
      eq(Meeting.isDeleted, false),
    ),
    orderBy: [desc(Meeting.joinAt)],
    with: {
      meetingBot: {
        columns: {
          recallBotId: true,
          transcriptRequested: true,
          notFound: true,
          intelligence: true,
          recordingUrl: true,
        },
      },
    },
  });
  let categorisedByDay: {
    [day: string]: typeof meetings;
  } = {};
  meetings = meetings?.filter(
    (mt) => !!mt.meetingBot && !mt.meetingBot.notFound,
  );
  meetings?.forEach((meeting) => {
    const day = meeting.joinAt
      ? dayjs(meeting.joinAt).format("MMM DD, YYYY")
      : "Recent";
    const currentDay = categorisedByDay[day];
    if (currentDay?.length > 0) {
      categorisedByDay[day].push(meeting);
    } else {
      categorisedByDay[day] = [meeting];
    }
  });
  // TODO: Add a page to show that there are no meetings
  // TODO: Add a component to show that there was an error fetching the meeting entries.
  console.log("No meetings found", categorisedByDay);
  if (Object.keys(categorisedByDay).length === 0) {
    return (
      <div className="py-32 flex justify-center items-center">
        <div className="flex flex-col justify-center gap-8">
          <Image
            src="/assets/meeting-list.svg"
            alt="Video Call"
            width={740}
            height={740}
          />
          <p className="text-center">
            No Call Recordings Found! Get started by integrating the plugins...
          </p>
          {installations.length < 3 && (
            <Link href={Paths.dashboard.integrations()} className="mx-auto">
              <Button
                className="h-10 mx-auto mt-4"
                color="teal.7"
                leftSection={<IconPlugConnected size={20} />}
              >
                Visit Integrations
              </Button>
            </Link>
          )}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {Object.keys(categorisedByDay).map((day) => {
        return (
          <div className="w-full pb-8" key={day}>
            <h3 className="text-lg font-bold text-gray-800">{day}</h3>
            <div className="mt-4 flex flex-wrap gap-4">
              {categorisedByDay &&
                categorisedByDay?.[day]?.map((meeting) => {
                  const { intelligence }: any = meeting?.meetingBot;
                  return (
                    <Paper
                      bg="dark.6"
                      className="p-4 w-[400px] flex flex-col justify-between"
                      key={meeting.id}
                      withBorder
                    >
                      <div>
                        <h5 className="mb-2 font-semibold text-base">
                          {meeting.meetingTitle} {meeting.meetingBot.notFound}
                        </h5>
                        <RecordingPlayer
                          recordingUrl={meeting?.meetingBot?.recordingUrl!}
                        />
                        <p className="my-4 text-sm">
                          {intelligence?.["assembly_ai.summary"]}
                        </p>
                      </div>
                      <div className="flex flex-row-reverse">
                        {!meeting?.meetingBot?.transcriptRequested ? (
                          <ProcessBotRecording
                            botId={meeting.meetingBot?.recallBotId!}
                            disabled={meeting.meetingBot?.transcriptRequested!}
                          />
                        ) : (
                          <Link
                            href={Paths.dashboard.meetingDetails(
                              meeting.id,
                              meeting.meetingBot?.recallBotId,
                            )}
                          >
                            <Button color="dark" variant="light">
                              Details
                            </Button>
                          </Link>
                        )}
                      </div>
                    </Paper>
                  );
                })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
