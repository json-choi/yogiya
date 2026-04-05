declare module "@mj-studio/react-native-naver-map" {
    import { Component } from "react";
    import { ViewProps } from "react-native";

    interface CameraPosition {
        latitude: number;
        longitude: number;
        zoom?: number;
    }

    interface NaverMapViewProps extends ViewProps {
        initialCamera?: CameraPosition;
        camera?: CameraPosition;
        onCameraChange?: (camera: CameraPosition) => void;
    }

    interface NaverMapMarkerOverlayProps {
        latitude: number;
        longitude: number;
        caption?: { text: string };
        onTap?: () => void;
        children?: React.ReactNode;
    }

    export class NaverMapView extends Component<NaverMapViewProps> {}
    export class NaverMapMarkerOverlay extends Component<NaverMapMarkerOverlayProps> {}
}
