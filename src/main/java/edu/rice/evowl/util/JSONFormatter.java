package edu.rice.evowl.util;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

public class JSONFormatter {

  public static Object objectToJson(Object object) {
    if (object instanceof List) {
      JSONArray jsonArray = new JSONArray();
      for (Object child : (List<?>) object) {
        jsonArray.put(objectToJson(child));
      }
      return jsonArray;
    } else if (object instanceof Map) {
      JSONObject jsonObject = new JSONObject();
      for (Map.Entry<?, ?> child : ((Map<?, ?>) object).entrySet()) {
        jsonObject.put(
          child.getKey().toString(),
          objectToJson(child.getValue())
        );
      }
      return jsonObject;
    } else {
      return object;
    }
  }

  public static String formatPeerData(
    List<List<String>> formatCriteria,
    List<List<String>> submission1,
    List<List<String>> submission2,
    String uniquePeaId,
    int totalPairs,
    int curIndex
  ) {
    JSONObject jsonData = new JSONObject();

    JSONArray submission1Array = new JSONArray(submission1);
    JSONArray submission2Array = new JSONArray(submission2);

    JSONObject filesObj = new JSONObject();
    filesObj.put("submission1", submission1Array);
    filesObj.put("submission2", submission2Array);

    JSONArray criteriaArray = new JSONArray(formatCriteria);

    jsonData.put("type", "peer");
    jsonData.put("criteria", criteriaArray);
    jsonData.put("files", filesObj);
    jsonData.put("unique_id", uniquePeaId);
    jsonData.put("total", totalPairs);
    jsonData.put("index", curIndex);
    System.out.println(
      "final JSON object to be sent to frontend: " + jsonData.toString()
    );
    return jsonData.toString();
  }

  public static String formatSelfData(
    List<List<String>> criteria,
    String uniqueSeaId,
    boolean isAfter
  ) {
    JSONObject jsonData = new JSONObject();
    jsonData.put("type", "self");
    jsonData.put("criteria", criteria);
    jsonData.put("unique_id", uniqueSeaId);
    jsonData.put("is_after", isAfter);
    System.out.println(
      "final JSON object to be sent to frontend: " + jsonData.toString()
    );
    return jsonData.toString();
  }

  public static String formatTrainingData(
    List<List<String>> formatCriteria,
    List<List<String>> submission1,
    List<List<String>> submission2,
    JSONArray answers,
    JSONArray feedback,
    Integer statusIdx,
    String uniqueID,
    int total
  ) {
    JSONObject jsonData = new JSONObject();
    JSONArray criteriaArray = new JSONArray(formatCriteria);
    JSONArray submission1Array = new JSONArray(submission1);
    JSONArray submission2Array = new JSONArray(submission2);
    jsonData.put("type", "training");
    jsonData.put("criteria", criteriaArray);
    jsonData.put("submission1", submission1);
    jsonData.put("submission2", submission2);
    jsonData.put("answers", answers);
    jsonData.put("feedback", feedback);
    jsonData.put("unique_id", uniqueID);
    jsonData.put("idx", statusIdx);
    jsonData.put("total", total);
    return jsonData.toString();
  }

  public static String formatInstructorData(
    List<List<String>> formatCriteria,
    List<List<String>> formatRubric,
    List<List<String>> submission0,
    String uniqueIeaId,
    int totalEvals,
    int curIndex,
    int round
  ) {
    JSONObject jsonData = new JSONObject();

    JSONArray submission0Array = new JSONArray(submission0);

    JSONObject filesObj = new JSONObject();
    filesObj.put("submission0", submission0Array);

    JSONArray criteriaArray = new JSONArray(formatCriteria);
    JSONArray rubricArray = new JSONArray(formatRubric);

    JSONObject criteriaObj = new JSONObject();
    criteriaObj.put("criteria_txt", criteriaArray);
    criteriaObj.put("rubric", rubricArray);

    jsonData.put("type", "instructor");
    jsonData.put("criteria", criteriaObj);
    jsonData.put("files", filesObj);
    jsonData.put("unique_id", uniqueIeaId);
    jsonData.put("total", totalEvals);
    jsonData.put("index", curIndex);
    jsonData.put("round", round);
    System.out.println(
      "final JSON object to be sent to frontend: " + jsonData.toString()
    );
    return jsonData.toString();
  }

  public static List<Object> parsePeerEval(String jsonString) {
    List<Object> result = new ArrayList<>();
    try {
      JSONObject jsonObject = new JSONObject(jsonString);

      String uniqueId = jsonObject.getString("unique_id");
      List<Integer> choices = new ArrayList<>();
      String timeStamp = jsonObject.getString("time_stamp");

      JSONArray choicesArray = jsonObject.getJSONArray("choices");
      for (int i = 0; i < choicesArray.length(); i++) {
        choices.add(choicesArray.getInt(i));
      }

      JSONArray freeResponsesArray = jsonObject.getJSONArray("free_responses");
      String[] freeResponses = new String[freeResponsesArray.length() * 2];
      for (int i = 0; i < freeResponsesArray.length(); i++) {
        JSONArray responseArray = freeResponsesArray.getJSONArray(i);
        freeResponses[i * 2] = responseArray.getString(0);
        freeResponses[i * 2 + 1] = responseArray.getString(1);
      }

      result.add(uniqueId);
      result.add(choices.toString());
      result.add(timeStamp);
      result.add(freeResponses);
    } catch (JSONException e) {
      e.printStackTrace();
    }
    return result;
  }

  public static List<Object> parseInstructorEval(String jsonString) {
    List<Object> result = new ArrayList<>();
    try {
      JSONObject jsonObject = new JSONObject(jsonString);

      String uniqueId = jsonObject.getString("unique_id");
      List<String> choices = new ArrayList<>();
      List<Double> deductions = new ArrayList<>();
      String timeStamp = jsonObject.getString("time_stamp");

      JSONArray choicesArray = jsonObject.getJSONArray("choices");
      JSONArray deductionArray = jsonObject.getJSONArray("deductions");
      for (int i = 0; i < choicesArray.length(); i++) {
        choices.add((String) choicesArray.get(i));
        deductions.add(Double.parseDouble((String) deductionArray.get(i)));
      }

      result.add(uniqueId);
      result.add(choices.toString());
      result.add(deductions.toString());
      result.add(timeStamp);
      result.add(jsonObject.getJSONArray("free_responses").toString());
    } catch (JSONException e) {
      e.printStackTrace();
    }
    return result;
  }

  public static List<Object> parseTraining(String jsonString) {
    List<Object> result = new ArrayList<>();
    try {
      JSONObject jsonObject = new JSONObject(jsonString);

      String uniqueId = jsonObject.getString("unique_id");
      List<Integer> choices = new ArrayList<>();
      String timeStamp = jsonObject.getString("time_stamp");

      JSONArray choicesArray = jsonObject.getJSONArray("choices");
      for (int i = 0; i < choicesArray.length(); i++) {
        choices.add(choicesArray.getInt(i));
      }

      result.add(uniqueId);
      result.add(choices.toString());
      result.add(timeStamp);
    } catch (JSONException e) {
      e.printStackTrace();
    }
    return result;
  }

  public static List<Object> parseReflection(String jsonString) {
    List<Object> result = new ArrayList<>();
    try {
      JSONObject jsonObject = new JSONObject(jsonString);

      String userId = jsonObject.getString("userId");
      int assignId = jsonObject.getInt("assignment_id");
      String response = jsonObject.getString("response");

      result.add(userId);
      result.add(assignId);
      result.add(response);
    } catch (JSONException e) {
      throw new RuntimeException(e);
    }
    return result;
  }
}
