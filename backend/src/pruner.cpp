#include <pybind11/pybind11.h>
#include <pybind11/numpy.h>
#include <opencv2/opencv.hpp>
#include <iostream>

namespace py = pybind11;

// Function to compute structural difference ratio between two frames
// Returns a dictionary with novelty, percentage difference, and ROI bbox
py::dict compute_diff(py::array_t<uint8_t> frame_a_in, py::array_t<uint8_t> frame_b_in) {
    py::buffer_info buf_a = frame_a_in.request();
    py::buffer_info buf_b = frame_b_in.request();

    if (buf_a.ndim != 3 || buf_b.ndim != 3) {
        throw std::runtime_error("Number of dimensions must be 3 (H, W, C)");
    }

    int h = buf_a.shape[0];
    int w = buf_a.shape[1];
    int c = buf_a.shape[2];

    cv::Mat frame_a(h, w, CV_8UC3, (uint8_t*)buf_a.ptr);
    cv::Mat frame_b(h, w, CV_8UC3, (uint8_t*)buf_b.ptr);

    cv::Mat gray_a, gray_b;
    cv::cvtColor(frame_a, gray_a, cv::COLOR_BGR2GRAY);
    cv::cvtColor(frame_b, gray_b, cv::COLOR_BGR2GRAY);

    cv::GaussianBlur(gray_a, gray_a, cv::Size(5, 5), 0);
    cv::GaussianBlur(gray_b, gray_b, cv::Size(5, 5), 0);

    cv::Mat diff;
    cv::absdiff(gray_a, gray_b, diff);
    
    // Threshold to ignore minor noise
    cv::Mat thresh;
    cv::threshold(diff, thresh, 30, 255, cv::THRESH_BINARY);

    int nonZero = cv::countNonZero(thresh);
    int totalPixels = h * w;

    float pct = (float)nonZero / (float)totalPixels;
    bool is_novel = pct >= 0.05;
    
    int bx = 0, by = 0, bw = w, bh = h;
    
    if (is_novel) {
        std::vector<std::vector<cv::Point>> contours;
        cv::findContours(thresh, contours, cv::RETR_EXTERNAL, cv::CHAIN_APPROX_SIMPLE);
        
        if (!contours.empty()) {
            double maxArea = 0;
            int maxIdx = 0;
            for (size_t i = 0; i < contours.size(); i++) {
                double area = cv::contourArea(contours[i]);
                if (area > maxArea) {
                    maxArea = area;
                    maxIdx = i;
                }
            }
            
            cv::Rect rect = cv::boundingRect(contours[maxIdx]);
            
            // Add 50px padding
            bx = std::max(0, rect.x - 50);
            by = std::max(0, rect.y - 50);
            int maxX = std::min(w, rect.x + rect.width + 50);
            int maxY = std::min(h, rect.y + rect.height + 50);
            bw = maxX - bx;
            bh = maxY - by;
        }
    }

    py::dict result;
    result["is_novel"] = is_novel;
    result["diff_percent"] = pct;
    
    py::list bbox;
    bbox.append(bx);
    bbox.append(by);
    bbox.append(bw);
    bbox.append(bh);
    result["bbox"] = bbox;

    return result;
}

PYBIND11_MODULE(pruner, m) {
    m.doc() = "C++ frame differencing optimization layer";
    m.def("compute_diff", &compute_diff, "Computes structural difference percentage and bbox between two frames",
          py::arg("frame_a"), py::arg("frame_b"));
}
