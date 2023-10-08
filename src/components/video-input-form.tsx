import { FileVideo, Upload } from "lucide-react";
import { Button } from "./ui/button";
import { Separator } from "./ui/separator";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import { ChangeEvent, FormEvent, useMemo, useRef, useState } from "react";
import { getFFmpeg } from "@/lib/ffmpeg";
import { fetchFile } from "@ffmpeg/util";
import { api } from "@/lib/axios";

type Status = "Waiting" | "Converting" | "Uploading" | "Generating" | "Success";

const statusMessage = {
    Converting: "Convertendo...",
    Uploading: "Carregando...",
    Generating: "transcrevendo...",
    Success: "Sucesso!",
};

interface VideoInputFormProps {
    onVideoUploaded: (id: string) => void;
}

export function VideoInputForm(props: VideoInputFormProps) {
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [status, setStatus] = useState<Status>("Waiting");
    const promptInputRef = useRef<HTMLTextAreaElement>(null);

    function handleFileSelected(event: ChangeEvent<HTMLInputElement>) {
        const { files } = event.currentTarget;

        if (!files) {
            return;
        }

        const selectedFile = files[0];

        setVideoFile(selectedFile);
    }

    async function convertVideoToAudio(video: File) {
        const ffmpeg = await getFFmpeg();

        await ffmpeg.writeFile("input.mp4", await fetchFile(video));

        // ffmpeg.on("log", (log) => {
        //     console.log(log);
        // });

        ffmpeg.on("progress", (progess) => {
            console.log("Convert progess:", Math.round(progess.progress * 100));
        });

        ffmpeg.exec([
            "-i",
            "input.mp4",
            "-map",
            "0:a",
            "-b:a",
            "20k",
            "-acodec",
            "libmp3lame",
            "output.mp3",
        ]);

        const data = await ffmpeg.readFile("output.mp3");
        const audioFileBlob = new Blob([data], { type: "audio/mpeg" });
        const audioFile = new File([audioFileBlob], "audio.mp3", {
            type: "audio/mp3",
        });

        return audioFile;
    }

    async function handleUploadVideo(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        const prompt = promptInputRef.current?.value;

        if (!videoFile) {
            return;
        }

        setStatus("Converting");

        const audioFile = await convertVideoToAudio(videoFile);

        const data = new FormData();

        data.append("file", audioFile);

        setStatus("Uploading");

        const response = await api.post("/videos", data);

        const { video } = response.data;

        setStatus("Generating");

        await api.post(`/videos/${video.id}/transcription`, {
            prompt,
        });

        setStatus("Success");

        props.onVideoUploaded(video.id);
    }

    const previewUrl = useMemo(() => {
        if (!videoFile) return null;

        return URL.createObjectURL(videoFile);
    }, [videoFile]);

    return (
        <form className="space-y-6" onSubmit={handleUploadVideo}>
            <label
                htmlFor="video"
                className=" relative border flex rounded-md aspect-video cursor-pointer border-dashed text-sm flex-col gap-2 items-center justify-center text-muted-foreground hover:bg-primary/5"
            >
                {previewUrl ? (
                    <video
                        src={previewUrl}
                        controls={false}
                        className="pointer-events-none absolute inset-0 w-full h-full"
                    />
                ) : (
                    <>
                        <FileVideo className="w-4 h-4" />
                        Selecione um vídeo
                    </>
                )}
            </label>

            <input
                type="file"
                id="video"
                accept="video/mp4"
                className="sr-only"
                onChange={handleFileSelected}
            />

            <Separator />

            <div className="space-y-2">
                <Label htmlFor="transcription_prompt">
                    Prompt de transcrição
                </Label>

                <Textarea
                    ref={promptInputRef}
                    id="transcription_prompt"
                    className="h-20 leading-relaxed resize-none"
                    placeholder="Inclua palavras chaves mencionadas no vídeo speradas por vírgula"
                    disabled={status !== "Waiting"}
                />
            </div>

            <Button
                disabled={status != "Waiting"}
                type="submit"
                data-success={status === "Success"}
                className="w-full data-[success=true]:bg-emerald-400"
            >
                {status === "Waiting" ? (
                    <>
                        Carregar Vídeo
                        <Upload className="w-4 h-4 ml-2" />
                    </>
                ) : (
                    statusMessage[status]
                )}
            </Button>
        </form>
    );
}
