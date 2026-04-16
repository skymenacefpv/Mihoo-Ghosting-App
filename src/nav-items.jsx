import { HomeIcon, PlayIcon, SettingsIcon, VideoIcon, PaletteIcon } from "lucide-react";
import Index from "./pages/Index.jsx";
import Training from "./pages/Training.jsx";
import Settings from "./pages/Settings.jsx";
import LiveTraining from "./pages/LiveTraining.jsx";
import CourtEditor from "./pages/CourtEditor.jsx";

/**
* Central place for defining the navigation items. Used for navigation components and routing.
*/
export const navItems = [
{
    title: "首页",
    to: "/",
    icon: <HomeIcon className="h-4 w-4" />,
    page: <Index />,
},
{
    title: "随机训练",
    to: "/training",
    icon: <PlayIcon className="h-4 w-4" />,
    page: <Training />,
},
{
    title: "实时训练",
    to: "/live-training",
    icon: <VideoIcon className="h-4 w-4" />,
    page: <LiveTraining />,
},
{
    title: "场地编辑",
    to: "/court-editor",
    icon: <PaletteIcon className="h-4 w-4" />,
    page: <CourtEditor />,
},
{
    title: "设置",
    to: "/settings",
    icon: <SettingsIcon className="h-4 w-4" />,
    page: <Settings />,
},
];
