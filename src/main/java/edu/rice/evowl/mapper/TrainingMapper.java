package edu.rice.evowl.mapper;

import java.util.List;
import java.util.Map;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Result;
import org.apache.ibatis.annotations.Results;
import org.apache.ibatis.annotations.Select;

public interface TrainingMapper {
  @Select(
    "SELECT submission1_paths, submission2_paths, answers, feedback FROM training WHERE assignment_id = #{assignment_id}"
  )
  @Results(
    id = "trainingResultsMap",
    value = {
      @Result(property = "submission1Paths", column = "submission1_paths"),
      @Result(property = "submission2Paths", column = "submission2_paths"),
      @Result(property = "answers", column = "answers"),
      @Result(property = "feedback", column = "feedback"),
    }
  )
  List<Map<String, Object>> getTrainingFormatById(
    @Param("assignment_id") Long assignment_id
  );
}
