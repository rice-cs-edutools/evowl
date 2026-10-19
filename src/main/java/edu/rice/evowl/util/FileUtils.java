package edu.rice.evowl.util;

import java.io.BufferedReader;
import java.io.File;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * A class providing a variety of utility functions for performing file I/O.
 */
public class FileUtils {

  /**
   * This method should take as its input a path to a directory. If the input path
   * does not point to a directory, this method should return a Set<String> containing
   * only the input path. Otherwise, it should return a Set<String> containing the
   * relative paths to all normal files (not directories) that are contained within
   * the specified directory, either directly or indirectly (within a subdirectory).
   * For example, given the input “/dir1/dir2” and the following directory structure:
   *
   * dir1/
   * |---dir2/
   *      |---file1.txt
   *      |---file2.txt
   *      |---file3.txt
   *      |---dir3/
   *           |---file4.txt
   *      |---dir4/
   *           |---dir5/
   *                |---file5.txt
   *
   * ...this method should return the set containing {“file1.txt”, “file2.txt”,
   * “file3.txt”, “dir3/file4.txt”, “dir4/dir5/file5.txt”}.
   *
   * @param dirpath the path
   * @return the set of relative paths to all normal files contained within dirpath
   */
  public static Set<String> getFilenames(String dirpath) {
    if (!new File(dirpath).isDirectory()) {
      throw new IllegalArgumentException("Submission directory not found: " + dirpath);
    }
    Set<String> fileNames = getFilenamesHelper(dirpath);
    Set<String> retval = new HashSet<>();
    for (String fileName : fileNames) {
      retval.add(fileName.substring(dirpath.length() + 1));
    }
    return retval;
  }

  public static Set<String> getFilenamesHelper(String dirpath) {
    File f = new File(dirpath);
    if (!f.isDirectory()) {
      Set<String> s = new HashSet<>();
      s.add(dirpath);
      return s;
    }

    Set<String> retval = new HashSet<>();
    String[] filePaths = f.list();
    for (String filePath : filePaths) {
      Set<String> results = getFilenamesHelper(dirpath + "/" + filePath);
      retval.addAll(results);
    }
    return retval;
  }

  public static List<List<String>> getSubJson(
    Set<String> relativeSubmission,
    String subPath
  ) {
    String coveragePrefix = "coverage-after/";
    List<List<String>> result = new ArrayList<>();

    // If any file has the coverage-after/ prefix, subPath is the
    // parent directory so strip the prefix; otherwise, subPath is
    // already the coverage-after directory and files are at root.
    boolean hasCoveragePrefix = false;
    for (String path : relativeSubmission) {
      if (path.startsWith(coveragePrefix)) {
        hasCoveragePrefix = true;
        break;
      }
    }

    for (String path : relativeSubmission) {
      if (hasCoveragePrefix && !path.startsWith(coveragePrefix)) {
        continue;
      }

      List<String> subList = new ArrayList<>();
      if (hasCoveragePrefix) {
        subList.add(path.substring(coveragePrefix.length()));
      } else {
        subList.add(path);
      }

      String absolutePath = subPath + "/" + path;
      String fileContent = getContentByPath(absolutePath);
      subList.add(fileContent);
      result.add(subList);
    }
    return result;
  }

  private static String getContentByPath(String absolutePath) {
    StringBuilder builder = new StringBuilder();
    try {
      File file = new File(absolutePath);
      if (file.isFile() && file.exists()) {
        InputStreamReader isr = new InputStreamReader(
          Files.newInputStream(file.toPath()),
          StandardCharsets.UTF_8
        );
        BufferedReader br = new BufferedReader(isr);
        String lineTxt = null;
        while ((lineTxt = br.readLine()) != null) {
          builder.append(lineTxt).append(System.lineSeparator());
        }
        br.close();
      } else {
        builder.append("File not found!");
      }
    } catch (Exception e) {
      e.printStackTrace();
    }
    return builder.toString();
  }
}
