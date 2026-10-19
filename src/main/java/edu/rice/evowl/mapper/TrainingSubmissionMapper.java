package edu.rice.evowl.mapper;

import edu.rice.evowl.entity.DynamicSelfEvalSubmission;
import edu.rice.evowl.entity.TrainingSubmission;
import edu.rice.evowl.mapper.providers.TrainingSubmissionSqlProvider;
import org.apache.ibatis.annotations.InsertProvider;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

public interface TrainingSubmissionMapper {
    @InsertProvider(type = TrainingSubmissionSqlProvider.class, method = "insertDynamic")
    void saveDynamicScoreRecord(TrainingSubmission trainingSubmission);
}
