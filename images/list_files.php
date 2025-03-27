<?php
$project = $_GET['project'];
$dir = __DIR__ . "/$project";

// Check if the directory exists
if (!is_dir($dir)) {
    http_response_code(404);
    echo json_encode(["error" => "Project not found"]);
    exit();
}

// Get all files in the directory
$files = array_diff(scandir($dir), array('.', '..'));

// Build URLs for the files
$file_urls = array_map(function ($file) use ($project) {
    return "/images/$project/$file";
}, $files);

// Reset the keys to ensure the JSON is an array
$file_urls = array_values($file_urls);

// Return JSON response
header('Content-Type: application/json');
echo json_encode($file_urls);
?>
